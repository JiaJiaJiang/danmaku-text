/*
Copyright luojia@luojia.me
LGPL license

danmaku-frame text2d mod
*/
'use strict';

import '../lib/setImmediate/setImmediate.js'
import Text2d from './text2d.js'
import Text3d from './text3d.js'
import TextCanvas from './textCanvas.js'



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
	let useImageBitmap=false;

	class TextDanmaku extends DanmakuFrameModule{
		constructor(frame){
			super(frame);
			this.list=[];//danmaku object array
			this.indexMark=0;//to record the index of last danmaku in the list
			this.tunnel=new tunnelManager();
			this.paused=true;
			this.randomText=`danmaku_text_${(Math.random()*999999)|0}`;
			this.defaultStyle={//these styles can be overwrote by the 'font' property of danmaku object
				fontStyle: null,
				fontWeight: 300,
				fontVariant: null,
				color: "#fff",
				fontSize: 24,
				fontFamily: "Arial",
				strokeWidth: 1,//outline width
				strokeColor: "#888",
				shadowBlur: 5,
				textAlign:'start',//left right center start end
				shadowColor: "#000",
				shadowOffsetX:0,
				shadowOffsetY:0,
				fill:true,//if the text should be filled
			};
			this.defaultStyle.__defineGetter__('lineHeight',function(){return this.fontSize+2;});
			frame.addStyle(`.${this.randomText}_fullfill{top:0;left:0;width:100%;height:100%;position:absolute;}`);

			defProp(this,'renderMode',{configurable:true});
			defProp(this,'activeRenderMode',{configurable:true,value:null});
			const con=this.container=document.createElement('div');
			con.classList.add(`${this.randomText}_fullfill`);
			frame.container.appendChild(con);

			//init modes
			this.text2d=new Text2d(this);
			this.text3d=new Text3d(this);
			this.textCanvas=new TextCanvas(this);
			
			this.textCanvasContainer.hidden=this.canvas.hidden=this.canvas3d.hidden=true;
			this.modes={
				1:this.textCanvas,
				2:this.text2d,
				3:this.text3d,
			};
			this.GraphCache=[];//text graph cache
			this.DanmakuText=[];

			//opt time record
			this.cacheCleanTime=0;
			this.danmakuMoveTime=0;
			this.danmakuCheckTime=0;

			this.danmakuCheckSwitch=true;
			this.options={
				allowLines:false,//allow multi-line danmaku
				screenLimit:0,//the most number of danmaku on the screen
				clearWhenTimeReset:true,//clear danmaku on screen when the time is reset
				speed:6.5,
			}
			addEvents(document,{
				visibilitychange:e=>{
					this.danmakuCheckSwitch=!document.hidden;
					if(!document.hidden)this.recheckIndexMark();
				}
			});
			this._checkNewDanmaku=this._checkNewDanmaku.bind(this);
			this._cleanCache=this._cleanCache.bind(this);
			setInterval(this._cleanCache,5000);//set an interval for cache cleaning
			this.setRenderMode(1);
		}
		setRenderMode(n){
			if(this.renderMode===n || !(n in this.modes) || !this.modes[n].supported)return;
			this.activeRenderMode&&this.activeRenderMode.disable();
			defProp(this,'activeRenderMode',{value:this.modes[n]});
			defProp(this,'renderMode',{value:n});
			this.activeRenderMode.resize();
			this.activeRenderMode.enable();
		}
		media(media){
			addEvents(media,{
				seeked:()=>{
					this.start();
					this.time();
					this._clearScreen();
				},
				seeking:()=>this.pause(),
				stalled:()=>this.pause(),
			});
		}
		start(){
			this.paused=false;
			this.recheckIndexMark();
			this.activeRenderMode.start();
		}
		pause(){
			this.paused=true;
			this.activeRenderMode.pause();
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
			//round d.style.fontSize to prevent Iifinity loop in tunnel
			if(typeof d.style!=='object')d.style={};
			d.style.fontSize=d.style.fontSize?((d.style.fontSize+0.5)|0):this.defaultStyle.fontSize;
			if(isNaN(d.style.fontSize)|| d.style.fontSize===Infinity || d.style.fontSize===0)d.style.fontSize=this.defaultStyle.fontSize;
			if(typeof d.mode !== 'number')d.mode=0;
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
			let d,time=this.frame.time;
			if(this.danmakuCheckTime===time || !this.danmakuCheckSwitch)return;
			if(this.list.length)
			for(;(this.indexMark<this.list.length)&&(d=this.list[this.indexMark])&&(d.time<=time);this.indexMark++){//add new danmaku
				if(this.options.screenLimit>0 && this.DanmakuText.length>=this.options.screenLimit){continue;}//continue if the number of danmaku on screen has up to limit or doc is not visible
				this._addNewDanmaku(d);
			}
			this.danmakuCheckTime=time;
		}
		_addNewDanmaku(d){
			const cHeight=this.height,cWidth=this.width;
			let t=this.GraphCache.length?this.GraphCache.shift():new TextGraph();
			t.danmaku=d;
			t.drawn=false;
			t.text=this.options.allowLines?d.text:d.text.replace(/\n/g,' ');
			t.time=d.time;
			Object.setPrototypeOf(t.font,this.defaultStyle);
			Object.assign(t.font,d.style);
			if(d.style.color){
				if(t.font.color && t.font.color[0]!=='#'){
					t.font.color='#'+d.style.color;
				}
			}

			if(d.mode>1)t.font.textAlign='center';
			t.prepare(this.renderMode===3?false:true);
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
			switch(d.mode){
				case 0:{t.style.x=cWidth;break;}
				case 1:{t.style.x=-t.style.width;break;}
				case 2:case 3:{t.style.x=(cWidth-t.style.width)/2;}
			}
			this.DanmakuText.push(t);
			this.activeRenderMode.newDanmaku(t);
		}
		_calcSideDanmakuPosition(t,T,cWidth){
			let R=!t.danmaku.mode,style=t.style;
			return (R?cWidth:(-style.width))
					+(R?-1:1)*this.frame.rate*(style.width+1024)*(T-t.time)*this.options.speed/60000;
		}
		_calcDanmakusPosition(force){
			let T=this.frame.time;
			if(!force){
				if(this.paused)return;
				if(this.danmakuMoveTime===T){
					this.pause();
					return;
				}
			}
			const cWidth=this.width;
			let R,i,t,style,X,rate=this.frame.rate;
			this.danmakuMoveTime=T;
			for(i=this.DanmakuText.length;i--;){
				t=this.DanmakuText[i];
				if(t.time>T){
					this.removeText(t);
					continue;
				}
				style=t.style;

				switch(t.danmaku.mode){
					case 0:case 1:{
						R=!t.danmaku.mode;
						style.x=X=this._calcSideDanmakuPosition(t,T,cWidth);
						if(t.tunnelNumber>=0 && ((R&&(X+style.width)+10<cWidth) || (!R&&X>10)) ){
							this.tunnel.removeMark(t);
						}else if( (R&&(X<-style.width-20)) || (!R&&(X>cWidth+style.width+20)) ){//go out the canvas
							this.removeText(t);
							continue;
						}
						break;
					}
					case 2:case 3:{
						if((T-t.time)>this.options.speed*1000/rate){
							this.removeText(t);
						}
					}
				}
			}
		}
		_cleanCache(force){//clean text object cache
			const now=Date.now();
			if(this.GraphCache.length>30 || force){//save 20 cached danmaku
				for(let ti = 0;ti<this.GraphCache.length;ti++){
					if(force || (now-this.GraphCache[ti].removeTime) > 10000){//delete cache which has not used for 10s
						this.activeRenderMode.deleteTextObject(this.GraphCache[ti]);
						this.GraphCache.splice(ti,1);
					}else{break;}
				}
			}
		}
		draw(force){
			if((!force&&this.paused)||!this.enabled)return;
			this._calcDanmakusPosition(force);
			this.activeRenderMode.draw(force);
			requestIdleCallback(this._checkNewDanmaku);
		}
		removeText(t){//remove the danmaku from screen
			let ind=this.DanmakuText.indexOf(t);
			if(ind>=0)this.DanmakuText.splice(ind,1);
			this.tunnel.removeMark(t);
			t._bitmap=t.danmaku=null;
			t.removeTime=Date.now();
			this.GraphCache.push(t);
			this.activeRenderMode.remove(t);
		}
		resize(){
			if(this.activeRenderMode)this.activeRenderMode.resize();
			this.draw(true);
		}
		_clearScreen(forceFull){
			this.activeRenderMode&&this.activeRenderMode.clear(forceFull);
		}
		clear(){//clear danmaku on the screen
			for(let i=this.DanmakuText.length,T;i--;){
				T=this.DanmakuText[i];
				if(T.danmaku)this.removeText(T);
			}
			this.tunnel.reset();
			this._clearScreen(true);
		}
		recheckIndexMark(t=this.frame.time){
			this.indexMark=dichotomy(this.list,t,0,this.list.length-1,true);
		}
		time(t=this.frame.time){//reset time,you should invoke it when the media has seeked to another time
			this.recheckIndexMark(t);
			if(this.options.clearWhenTimeReset){this.clear();}
			else{this.resetTimeOfDanmakuOnScreen();}
		}
		resetTimeOfDanmakuOnScreen(cTime){
			//cause the position of the danmaku is based on time
			//and if you don't want these danmaku on the screen to disappear after seeking,their time should be reset
			if(cTime===undefined)cTime=this.frame.time;
			this.DanmakuText.forEach(t=>{
				if(!t.danmaku)return;
				t.time=cTime-(this.danmakuMoveTime-t.time);
			});
		}
		danmakuAt(x,y){//return a list of danmaku which covers this position
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
			this.textCanvasContainer.hidden=false;
			if(this.frame.working)this.start();
		}
		disable(){//disable the plugin
			this.textCanvasContainer.hidden=true;
			this.pause();
			this.clear();
		}
		set useImageBitmap(v){
			useImageBitmap=(typeof createImageBitmap ==='function')?v:false;
		}
		get useImageBitmap(){return useImageBitmap;}
		get width(){return this.frame.width;}
		get height(){return this.frame.height;}
	}


	class TextGraph{//code copied from CanvasObjLibrary
		constructor(text=''){
			this._fontString='';
			this._renderList=null;
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
			let w = 0,tw,lh=(typeof this.font.lineHeight ==='number')?this.font.lineHeight:this.font.fontSize;
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
			if(!this.danmaku)return;
			this.render(this._cache.ctx2d);
			if(useImageBitmap){//use ImageBitmap
				if(this._bitmap){
					this._bitmap.close();
					this._bitmap=null;
				}
				createImageBitmap(this._cache).then(bitmap=>{
					this._bitmap=bitmap;
				});
			}
		}
		render(ct){//render text
			if(!this._renderList)return;
			ct.save();
			if(this.danmaku.highlight){
				ct.fillStyle='rgba(255,255,255,0.3)';
				ct.beginPath();
				ct.rect(0,0,this.style.width,this.style.height);
				ct.fill();
			}
			ct.font=this._fontString;//set font
			ct.textBaseline = 'middle';
			ct.lineWidth = this.font.strokeWidth;
			ct.fillStyle = this.font.color;
			ct.strokeStyle = this.font.strokeColor;
			ct.shadowBlur = this.font.shadowBlur;
			ct.shadowColor= this.font.shadowColor;
			ct.shadowOffsetX = this.font.shadowOffsetX;
			ct.shadowOffsetY = this.font.shadowOffsetY;
			ct.textAlign = this.font.textAlign;
			let lh=(typeof this.font.lineHeight ==='number')?this.font.lineHeight:this.font.fontSize,
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
				this.font.strokeWidth&&ct.strokeText(this._renderList[i],x,lh*(i+0.5));
				this.font.fill&&ct.fillText(this._renderList[i],x, lh*(i+0.5));
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
			if(typeof size !=='number' || size<=0){
				console.error('Incorrect size:'+size);
				size=24;
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
function emptyFunc(){}
export default init;