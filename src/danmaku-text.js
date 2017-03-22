/*
Copyright luojia@luojia.me
LGPL license

danmaku-frame text2d mod
*/
'use strict';

import '../lib/setImmediate/setImmediate.js'
import Promise from '../lib/promise/promise.js'
import Mat from '../lib/Mat/Mat.js'
import Text2d from './text2d.js'
import Text3d from './text3d.js'

if (!window.Promise)window.Promise = Promise;


/*
danmaku obj struct
{
	_:'text',
	time:(number)msec time,
	text:(string),
	style:(object)to be combined whit default style,
	mode:(number)
}

danmaku mode
	0:right
	1:left
	2:bottom
	3:top
*/

function init(DanmakuFrame,DanmakuFrameModule){
	const defProp=Object.defineProperty;
	const requestIdleCallback=window.requestIdleCallback||setImmediate;


	class TextDanmaku extends DanmakuFrameModule{
		constructor(frame){
			super(frame);
			this.list=[];//danmaku object array
			this.indexMark=0;//to record the index of last danmaku in the list
			this.tunnel=new tunnelManager();
			this.paused=true;
			this.defaultStyle={//these styles can be overwrote by the 'font' property of danmaku object
				fontStyle: null,
				fontWeight: 300,
				fontVariant: null,
				color: "#fff",
				lineHeight: null,//when this style is was not a number,the number will be the same as fontSize
				fontSize: 30,
				fontFamily: "Arial",
				strokeWidth: 1,//outline width
				strokeColor: "#888",
				shadowBlur: 5,
				textAlign:'start',//left right center start end
				shadowColor: "#000",
				shadowOffsetX:0,
				shadowOffsetY:0,
				fill:true,//if the text should be filled
				reverse:false,
				opacity:1,
			};

			defProp(this,'renderMode',{configurable:true});
			this.text2d=new Text2d(this);
			this.text3d=new Text3d(this);
			this.textDanmakuContainer=document.createElement('div');
			this.textDanmakuContainer.classList.add('NyaP_fullfill');
			this.canvas=document.createElement('canvas');//the canvas
			this.canvas.classList.add('NyaP_fullfill');
			this.canvas.id='text2d';
			this.canvas3d=document.createElement('canvas');//the canvas
			this.canvas3d.classList.add('NyaP_fullfill');
			this.canvas3d.id='text3d';
			this.canvas.hidden=this.canvas3d.hidden=true;
			this.context2d=this.canvas.getContext('2d');//the canvas context
			try{
				this.context3d=this.canvas.getContext('webgl');//the canvas3d context
			}catch(e){console.warn('WebGL not supported');}

			this.textDanmakuContainer.appendChild(this.canvas);
			this.textDanmakuContainer.appendChild(this.canvas3d);
			frame.container.appendChild(this.textDanmakuContainer);
			this.GraphCache=[];//COL text graph cache
			this.DanmakuText=[];

			this.cacheCleanTime=0;
			this.danmakuMoveTime=0;
			this.danmakuCheckSwitch=true;
			this.options={
				allowLines:false,//allow multi-line danmaku
				screenLimit:0,//the most number of danmaku on the screen
				clearWhenTimeReset:true,//clear danmaku on screen when the time is reset
				speed:5,
			}
			document.addEventListener('visibilitychange',e=>{
				if(document.hidden){
					this.pause();
				}else{
					this.reCheckIndexMark();
					if(this.frame.working)this.start();
					else{this.draw(true);}
				}
			});
			this._checkNewDanmaku=this._checkNewDanmaku.bind(this);
			this._cleanCache=this._cleanCache.bind(this);
			setInterval(this._cleanCache,5000);//set an interval for cache cleaning
			this.setRenderMode(2);
		}
		setRenderMode(n){
			if(this.renderMode===n)return;
			defProp(this,'renderMode',{value:n});
			this.clear();
			if(n===2){
				this.canvas.hidden=!(this.canvas3d.hidden=true);
			}else if(n===3){
				this.canvas3d.hidden=!(this.canvas.hidden=true);
			}
		}
		media(media){
			addEvents(media,{
				seeked:()=>{
					this.start();
					this.time();
					this._clearCanvas();
				},
				seeking:()=>{
					this.pause();
				},
				stalled:()=>{
					this.pause();
				},
			});
		}
		start(){
			this.paused=false;
			//this._clearCanvas(true);
			//this.resetTimeOfDanmakuOnScreen();
		}
		pause(){
			this.paused=true;
		}
		load(d){
			if(!d || d._!=='text'){return false;}
			if(typeof d.text !== 'string'){
				console.error('wrong danmaku object:',d);
				return false;
			}
			let t=d.time,ind,arr=this.list;
			ind=dichotomy(arr,d.time,0,arr.length-1,false)
			arr.splice(ind,0,d);
			if(ind<this.indexMark)this.indexMark++;
			//round d.size to prevent Iifinity loop in tunnel
			d.size=(d.size+0.5)|0;
			if(d.size===NaN || d.size===Infinity)d.size=this.defaultStyle.fontSize;
			return d;
		}
		loadList(danmakuArray){
			danmakuArray.forEach(d=>this.load(d));
		}
		unload(d){
			if(!d || d._!=='text')return false;
			const i=this.list.indexOf(d);
			if(i<0)return false;
			this.list.splice(i,1);
			if(i<this.indexMark)this.indexMark--;
			return true;
		}
		_checkNewDanmaku(){
			let d,time=this.frame.time,hidden=document.hidden;
			if(this.list.length)
			for(;(this.indexMark<this.list.length)&&(d=this.list[this.indexMark])&&(d.time<=time);this.indexMark++){//add new danmaku
				if(this.options.screenLimit>0 && this.DanmakuText.length>=this.options.screenLimit ||hidden){continue;}//continue if the number of danmaku on screen has up to limit or doc is not visible
				this._addNewDanmaku(d);
			}
			//calc all danmaku's position
			this._calcDanmakuPosition();
		}
		_addNewDanmaku(d){
			const cHeight=this.canvas.height,cWidth=this.canvas.width;
			let t
			if(this.GraphCache.length){
				t=this.GraphCache.shift();
			}else{
				t=new TextGraph();
			}
			t.danmaku=d;
			t.drawn=false;
			t.text=this.options.allowLines?d.text:d.text.replace(/\n/g,' ');
			t.time=d.time;
			Object.setPrototypeOf(t.font,this.defaultStyle);
			Object.assign(t.font,d.style);
			if(d.color)t.font.color='#'+d.color;

			//t.style.opacity=t.font.opacity;
			if(d.mode>1)t.font.textAlign='center';
			t.prepare(true);
			//find tunnel number
			const tnum=this.tunnel.getTunnel(t,cHeight);
			//calc margin
			let margin=(tnum<0?0:tnum)%cHeight;
			switch(d.mode){
				case 0:case 1:case 3:{
					t.style.y=margin;break;
				}
				case 2:{
					t.style.y=cHeight-margin-t.style.height-1;
				}
			}
			if(d.mode>1){
				t.style.x=(cWidth-t.style.width)/2;
			}else{
				t.style.x=cWidth;
			}
			this.DanmakuText.push(t);
		}
		_calcDanmakuPosition(){
			let F=this.frame,T=F.time;
			if((this.danmakuMoveTime===T)||this.paused)return;
			const cWidth=this.canvas.width;
			let R,i,t;
			this.danmakuMoveTime=T;
			for(i=this.DanmakuText.length;i--;){
				t=this.DanmakuText[i];
				if(t.time>T){
					this.removeText(t);
					continue;
				}
				switch(t.danmaku.mode){
					case 0:case 1:{
						R=!t.danmaku.mode;
						t.style.x=(R?cWidth:(-t.style.width))
							+(R?-1:1)*F.rate*(t.style.width+cWidth)*(T-t.time)*this.options.speed/60000;
						if((R&&t.style.x<-t.style.width) || (!R&&t.style.x>cWidth+t.style.width)){//go out the canvas
							this.removeText(t);
							continue;
						}else if(t.tunnelNumber>=0 && ((R&&(t.style.x+t.style.width)+10<cWidth) || (!R&&t.style.x>10))){
							this.tunnel.removeMark(t);
						}
						break;
					}
					case 2:case 3:{
						if((T-t.time)>this.options.speed*1000/F.rate){
							this.removeText(t);
						}
					}
				}
			}
		}
		_cleanCache(){//clean text object cache
			const now=Date.now();
			if(this.GraphCache.length>30){//save 20 cached danmaku
				for(let ti = 0;ti<this.GraphCache.length;ti++){
					if((now-this.GraphCache[ti].removeTime) > 10000){//delete cache which has live over 10s
						this.GraphCache.splice(ti,1);
					}else{break;}
				}
			}
		}
		draw(force){
			if(!this.enabled || (!force&&this.paused))return;
			this._clearCanvas(force);
			if(this.renderMode===2){this.text2d.draw(force);}
			else if(this.renderMode===3){this.text3d.draw(force);}
			//this.list.length&&this.COL.draw();

			//find danmaku from indexMark to current time
			requestIdleCallback(this._checkNewDanmaku);
		}
		removeText(t){//remove the danmaku from screen
			let ind=this.DanmakuText.indexOf(t);
			t._bitmap=null;
			if(ind>=0)this.DanmakuText.splice(ind,1);
			this.tunnel.removeMark(t);
			t.danmaku=null;
			t.removeTime=Date.now();
			this.GraphCache.push(t);
		}
		resize(){
			this.canvas.width=this.canvas3d.width=this.frame.container.offsetWidth;
			this.canvas.height=this.canvas3d.height=this.frame.container.offsetHeight;
			//this.COL.adjustCanvas();
			this.draw(true);
		}
		_evaluateIfFullClearMode(){
			if(this.renderMode===3)return true;
			if(this.DanmakuText.length>3)return true;
			//if(this.COL.debug.switch)return true;
			let l=this.GraphCache[this.GraphCache.length-1];
			if(l&&l.drawn){
				l.drawn=false;
				return true;
			}
			return false;
		}
		_clearCanvas(forceFull){
			switch(this.renderMode){
				case 2:{
					forceFull||(forceFull=this._evaluateIfFullClearMode());
					this.text2d.clear(forceFull);
					break;
				}
				case 3:{
					this.text3d.clear();
				}
			}
		}
		clear(){//clear danmaku on the screen
			for(let i=this.DanmakuText.length,T;i--;){
				T=this.DanmakuText[i];
				if(T.danmaku)this.removeText(T);
			}
			this.tunnel.reset();
			this._clearCanvas(true);
		}
		reCheckIndexMark(t=this.frame.time){
			this.indexMark=dichotomy(this.list,t,0,this.list.length-1,true);
		}
		time(t=this.frame.time){//reset time,you should invoke it when the media has seeked to another time
			this.reCheckIndexMark(t);
			if(this.options.clearWhenTimeReset){this.clear();}
			else{this.resetTimeOfDanmakuOnScreen();}
		}
		resetTimeOfDanmakuOnScreen(cTime){
			//cause the position of the danmaku is based on time
			//and if you don't want these danmaku on the screen to disappear,their time should be reset
			if(cTime===undefined)cTime=this.frame.time;
			this.DanmakuText.forEach(t=>{
				if(!t.danmaku)return;
				t.time=cTime-(this.danmakuMoveTime-t.time);
			});
		}
		danmakuAt(x,y){//return a list of danmaku which is over this position
			const list=[];
			if(!this.enabled)return list;
			this.DanmakuText.forEach(t=>{
				if(!t.danmaku)return;
				if(t.style.x<=x && t.style.x+t.style.width>=x && t.style.y<=y && t.style.y+t.style.height>=y)
					list.push(t.danmaku);
			});
			return list;
		}
		enable(){//enable the plugin
			this.textDanmakuContainer.hidden=false;
		}
		disable(){//disable the plugin
			this.textDanmakuContainer.hidden=true;
			this.pause();
			this.clear();
		}
	}


	class TextGraph{//code copied from CanvasObjLibrary
		constructor(text=''){
			this._fontString='';
			this._renderList=null;
			this.useImageBitmap=true;
			this.style={};
			this.font={};
			this.text=text;
			this._renderToCache=this._renderToCache.bind(this);
			defProp(this,'_cache',{configurable:true});
		}
		prepare(async=false){//prepare text details
			if(!this._cache){
				defProp(this,'_cache',{value:document.createElement("canvas")});
			}
			let ta=[];
			(this.font.fontStyle)&&ta.push(this.font.fontStyle);
			(this.font.fontVariant)&&ta.push(this.font.fontVariant);
			(this.font.fontWeight)&&ta.push(this.font.fontWeight);
			ta.push(`${this.font.fontSize}px`);
			(this.font.fontFamily)&&ta.push(this.font.fontFamily);
			this._fontString = ta.join(' ');

			const imgobj = this._cache,ct = (imgobj.ctx2d||(imgobj.ctx2d=imgobj.getContext("2d")));
			ct.font = this._fontString;
			this._renderList = this.text.split(/\n/g);
			this.estimatePadding=Math.max(
				this.font.shadowBlur+5+Math.max(Math.abs(this.font.shadowOffsetY),Math.abs(this.font.shadowOffsetX)),
				this.font.strokeWidth+3
			);
			let w = 0,tw,lh=(typeof this.font.lineHeigh ==='number')?this.font.lineHeigh:this.font.fontSize;
			for (let i = this._renderList.length; i -- ;) {
				tw = ct.measureText(this._renderList[i]).width;
				(tw>w)&&(w=tw);//max
			}
			imgobj.width = (this.style.width = w) + this.estimatePadding*2;
			imgobj.height = (this.style.height = this._renderList.length * lh)+ ((lh<this.font.fontSize)?this.font.fontSize*2:0) + this.estimatePadding*2;

			ct.translate(this.estimatePadding, this.estimatePadding);
			if(async){
				requestIdleCallback(this._renderToCache);
			}else{
				this._renderToCache();
			}
		}
		_renderToCache(){
			this.render(this._cache.ctx2d);
			if(this.useImageBitmap && typeof createImageBitmap ==='function'){//use ImageBitmap
				createImageBitmap(this._cache).then((bitmap)=>{
					if(this._bitmap)this._bitmap.close();
					this._bitmap=bitmap;
				});
			}
		}
		render(ct){//render text
			if(!this._renderList)return;
			ct.save();
			ct.font=this._fontString;//set font
			ct.textBaseline = 'top';
			ct.lineWidth = this.font.strokeWidth;
			ct.fillStyle = this.font.color;
			ct.strokeStyle = this.font.strokeColor;
			ct.shadowBlur = this.font.shadowBlur;
			ct.shadowColor= this.font.shadowColor;
			ct.shadowOffsetX = this.font.shadowOffsetX;
			ct.shadowOffsetY = this.font.shadowOffsetY;
			ct.textAlign = this.font.textAlign;
			let lh=(typeof this.font.lineHeigh ==='number')?this.font.lineHeigh:this.font.fontSize,
				x;
			switch(this.font.textAlign){
				case 'left':case 'start':{
					x=0;break;
				}
				case 'center':{
					x=this.style.width/2;break;
				}
				case 'right':case 'end':{
					x=this.style.width;
				}
			}

			for (let i = this._renderList.length;i--;) {
				this.font.strokeWidth&&ct.strokeText(this._renderList[i],x,lh*i);
				this.font.fill&&ct.fillText(this._renderList[i],x, lh*i);
			}
			ct.restore();
		}
	}

	class tunnelManager{
		constructor(){
			this.reset();
		}
		reset(){
			this.right={};
			this.left={};
			this.bottom={};
			this.top={};
		}
		getTunnel(tobj,cHeight){//get the tunnel index that can contain the danmaku of the sizes
			let tunnel=this.tunnel(tobj.danmaku.mode),
				size=tobj.style.height,
				ti=0,
				tnum=-1;
			if(typeof size !=='number' || size<0){
				console.error('Incorrect size:'+size);
				size=1;
			}
			if(size>cHeight)return 0;

			while(tnum<0){
				for(let t=ti+size-1;ti<=t;){
					if(tunnel[ti]){//used
						ti+=tunnel[ti].tunnelHeight;
						break;
					}else if((ti!==0)&&(ti%(cHeight-1))===0){//new page
						ti++;
						break;
					}else if(ti===t){//get
						tnum=ti-size+1;
						break;
					}else{
						ti++;
					}
				}
			}
			tobj.tunnelNumber=tnum;
			tobj.tunnelHeight=(((tobj.style.y+size)>cHeight)?1:size);
			this.addMark(tobj);
			return tnum;
		}
		addMark(tobj){
			let t=this.tunnel(tobj.danmaku.mode);
			if(!t[tobj.tunnelNumber])t[tobj.tunnelNumber]=tobj;
		}
		removeMark(tobj){
			let t,tun=tobj.tunnelNumber;
			if(tun>=0&&(t=this.tunnel(tobj.danmaku.mode))[tun]===tobj){
				delete t[tun];
				tobj.tunnelNumber=-1;
			}
		}
		tunnel(id){
			return this[tunnels[id]];
		}
	}

	const tunnels=['right','left','bottom','top'];

	function dichotomy(arr,t,start,end,position=false){
		if(arr.length===0)return 0;
		let m=start,s=start,e=end;
		while(start <= end){//dichotomy
			m=(start+end)>>1;
			if(t<=arr[m].time)end=m-1;
			else{start=m+1;}
		}
		if(position){//find to top
			while(start>0 && (arr[start-1].time===t)){
				start--;
			}
		}else{//find to end
			while(start<=e &&  (arr[start].time===t)){
				start++;
			}
		}
		return start;
	}

	DanmakuFrame.addModule('TextDanmaku',TextDanmaku);
};

function addEvents(target,events={}){
	for(let e in events)e.split(/\,/g).forEach(e2=>target.addEventListener(e2,events[e]));
}
function limitIn(num,min,max){//limit the number in a range
	return num<min?min:(num>max?max:num);
}

export default init;