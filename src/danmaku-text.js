/*
Copyright luojia@luojia.me
LGPL license

danmaku-frame text2d mod
*/
'use strict';

import {CanvasObjLibrary,requestIdleCallback} from '../lib/CanvasObjLibrary/src/CanvasObjLibrary.js';

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
	class Text2D extends DanmakuFrameModule{
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

			this.canvas=document.createElement('canvas');//the canvas
			Object.assign(this.canvas.style,{position:'absolute',width:'100%',height:'100%',top:0,left:0});
			this.context2d=this.canvas.getContext('2d');//the canvas context
			this.COL=new CanvasObjLibrary(this.canvas);//the library
			this.COL.imageSmoothingEnabled=false;
			this.COL.autoClear=false;
			frame.container.appendChild(this.canvas);
			this.COL_GraphCache=[];//COL text graph cache
			this.COL_DanmakuText=[];
			this.layer=new this.COL.class.FunctionGraph();//text layer
			this.layer.drawer=ct=>{this._layerDrawFunc(ct);}//set draw func
			this.COL.root.appendChild(this.layer);
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
					this.start();
				}
			});
			this._checkNewDanmaku=this._checkNewDanmaku.bind(this);
			this._cleanCache=this._cleanCache.bind(this);
			setInterval(this._cleanCache,5000);//set an interval for cache cleaning
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
			return true;
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
		_layerDrawFunc(ctx){
			for(let i=0,t;i<this.COL_DanmakuText.length;i++){
				t=this.COL_DanmakuText[i];
				t.drawn||(t.drawn=true);
				ctx.drawImage((t.useImageBitmap&&t._bitmap)?t._bitmap:t._cache, t.style.x-t.estimatePadding, t.style.y-t.estimatePadding);
			}
		}
		_checkNewDanmaku(){
			const cHeight=this.COL.canvas.height,cWidth=this.COL.canvas.width;
			let t,d,time=this.frame.time,hidden=document.hidden;
			if(this.list.length)
			for(;(this.indexMark<this.list.length)&&(d=this.list[this.indexMark])&&(d.time<=time);this.indexMark++){//add new danmaku
				if(this.options.screenLimit>0 && this.COL_DanmakuText.length>=this.options.screenLimit ||hidden){continue;}//continue if the number of danmaku on screen has up to limit or doc is not visible
				if(this.COL_GraphCache.length){
					t=this.COL_GraphCache.shift();
				}else{
					t=new this.COL.class.TextGraph();
					t.onoverCheck=false;
				}
				t.danmaku=d;
				t.drawn=false;
				t.text=this.options.allowLines?d.text:d.text.replace(/\n/g,' ');
				t.time=d.time;
				t.font=Object.assign({},d.style);
				t.font.__proto__=this.defaultStyle;
				t.style.opacity=t.font.opacity;
				if(d.mode>1)t.font.textAlign='center';
				t.prepare(true);
				//find tunnel number
				const tnum=this.tunnel.getTunnel(t,this.COL.canvas.height);
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
					t.style.x=(this.COL.canvas.width-t.style.width)/2;
				}else{
					t.style.x=cWidth;
				}
				this.COL_DanmakuText.push(t);
			}
			//calc all danmaku's position
			this._calcDanmakuPosition();
		}
		_calcDanmakuPosition(){
			let F=this.frame,T=F.time;
			if((this.danmakuMoveTime===T)||this.paused)return;
			const 	cWidth=this.COL.canvas.width;
			let R,i,t;
			this.danmakuMoveTime=T;
			for(i=this.COL_DanmakuText.length;i--;){
				t=this.COL_DanmakuText[i];
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
		_cleanCache(){//clean COL text object cache
			const now=Date.now();
			if(this.COL_GraphCache.length>30){//save 20 cached danmaku
				for(let ti = 0;ti<this.COL_GraphCache.length;ti++){
					if((now-this.COL_GraphCache[ti].removeTime) > 10000){//delete cache which has live over 10s
						this.COL_GraphCache.splice(ti,1);
					}else{break;}
				}
			}
		}
		draw(force){
			if(!this.enabled || (!force&&this.paused))return;
			this._clearCanvas(force);
			this.COL.draw();

			//find danmaku from indexMark to current time
			requestIdleCallback(this._checkNewDanmaku);
		}
		removeText(t){//remove the danmaku from screen
			let ind=this.COL_DanmakuText.indexOf(t);
			t._bitmap=null;
			if(ind>=0)this.COL_DanmakuText.splice(ind,1);
			this.tunnel.removeMark(t);
			t.danmaku=null;
			t.removeTime=Date.now();
			this.COL_GraphCache.push(t);
		}
		resize(){
			this.COL.adjustCanvas();
			this.draw(true);
		}
		_evaluateIfFullClearMode(){
			if(this.COL_DanmakuText.length>3)return true;
			if(this.COL.debug.switch)return true;
			let l=this.COL_GraphCache[this.COL_GraphCache.length-1];
			if(l&&l.drawn){
				l.drawn=false;
				return true;
			}
			return false;
		}
		_clearCanvas(forceFull){
			if(forceFull||this._evaluateIfFullClearMode()){
				this.COL.clear();
				return;
			}
			let ctx=this.COL.context,t;
			for(let i=this.COL_DanmakuText.length;i--;){
				t=this.COL_DanmakuText[i];
				if(t.drawn){
					ctx.clearRect(t.style.x-t.estimatePadding,t.style.y-t.estimatePadding,t._cache.width,t._cache.height);
				}
			}
		}
		clear(){//clear danmaku on the screen
			for(let i=this.COL_DanmakuText.length,T;i--;){
				T=this.COL_DanmakuText[i];
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
		resetTimeOfDanmakuOnScreen(cTime=this.frame.time){
			//cause the position of the danmaku is based on time
			//and if you don't want these danmaku on the screen to disappear,their time should be reset
			this.COL_DanmakuText.forEach(t=>{
				if(!t.danmaku)return;
				t.time=cTime-(this.danmakuMoveTime-t.time);
			});
		}
		danmakuAt(x,y){//return a list of danmaku which is over this position
			const list=[];
			if(!this.enabled)return list;
			this.COL_DanmakuText.forEach(t=>{
				if(!t.danmaku)return;
				if(t.style.x<=x && t.style.x+t.style.width>=x && t.style.y<=y && t.style.y+t.style.height>=y)
					list.push(t.danmaku);
			});
			return list;
		}
		enable(){//enable the plugin
			this.layer.style.hidden=false;
		}
		disable(){//disable the plugin
			this.layer.style.hidden=true;
			this.clear();
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

	DanmakuFrame.addModule('text2d',Text2D);
};

function addEvents(target,events={}){
	for(let e in events)e.split(/\,/g).forEach(e2=>target.addEventListener(e2,events[e]));
}
function limitIn(num,min,max){//limit the number in a range
	return num<min?min:(num>max?max:num);
}

export default init;