/*
Copyright luojia@luojia.me
LGPL license

danmaku-frame text2d mod
*/
'use strict';

import CanvasObjLibrary from '../lib/CanvasObjLibrary/src/CanvasObjLibrary.js';

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
			document.addEventListener('visibilityChange',e=>{
				if(document.hidden){
					this.pause();
				}else{
					this.reCheckIndexMark();
					this.start();
				}
			});
		}
		media(media){
			addEvents(media,{
				seeked:()=>{
					this.time();
					this.start();
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
			for(let d of danmakuArray){
				this.load(d);
			}
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
			const 	cWidth=this.COL.canvas.width;
					
			let x,Mright,i,t,DT=this.COL_DanmakuText;
			for(i=0;i<DT.length;i++){
				t=this.COL_DanmakuText[i];
				if(i+1<DT.length && t.time>DT[i+1].time){//clean danmakus at the wrong time
					this.removeText(t);
					continue;
				}
				switch(t.danmaku.mode){
					case 0:case 1:{
						Mright=!t.danmaku.mode;
						t.style.x=x=(Mright?cWidth:(-t.style.width))
							+(Mright?-1:1)*this.frame.rate*(t.style.width+cWidth)*(this.frame.time-t.time)*this.options.speed/60000;
						if((Mright&&x<-t.style.width) || (!Mright&&x>cWidth+t.style.width)){//go out the canvas
							this.removeText(t);
							continue;
						}else if(t.tunnelNumber>=0 && ((Mright&&(x+t.style.width)+30<cWidth) || (!Mright&&x>30))){
							this.tunnel.removeMark(t);
						}
						ctx.drawImage(t._bitmap?t._bitmap:t._cache, x-t.estimatePadding, t.style.y-t.estimatePadding);
						break;
					}
					case 2:case 3:{
						if((this.frame.time-t.time)>this.options.speed*1000/this.frame.rate){
							this.removeText(t);
							continue;
						}
						ctx.drawImage(t._bitmap?t._bitmap:t._cache, t.style.x-t.estimatePadding, t.style.y-t.estimatePadding);
					}
				}
			}
				
		}
		draw(force){
			if(!this.enabled)return;
			//find danmaku from indexMark to current time
			if(!force&&((this.danmakuMoveTime==this.frame.time)||this.paused))return;
			const 	cHeight=this.COL.canvas.height,
					now=Date.now();
			let t,d;
			if(!force&&this.list.length&&this.danmakuCheckSwitch&&!document.hidden){
				for(;(d=this.list[this.indexMark])&&(d.time<=this.frame.time);this.indexMark++){//add new danmaku
					if(this.options.screenLimit>0 && this.COL_DanmakuText.length>=this.options.screenLimit ||document.hidden)continue;//continue if the number of danmaku on screen has up to limit or doc is not visible
					d=this.list[this.indexMark];
					t=this.COL_GraphCache.length?this.COL_GraphCache.shift():new this.COL.class.TextGraph();
					t.onoverCheck=false;
					t.danmaku=d;
					t.drawn=false;
					t.text=this.options.allowLines?d.text:d.text.replace(/\n/g,' ');
					t.time=d.time;
					t.font=Object.create(this.defaultStyle);
					Object.assign(t.font,d.style);
					t.style.opacity=t.font.opacity;
					if(d.mode>1)t.font.textAlign='center';
					t.prepare(true);
					//find tunnel number
					const size=t.style.height,tnum=this.tunnel.getTunnel(t,this.COL.canvas.height);
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
					}
					this.COL_DanmakuText.push(t);
				}
				this.danmakuCheckSwitch=false;
			}else{
				this.danmakuCheckSwitch=true;
			}
			//calc all danmaku's position
			this.danmakuMoveTime=this.frame.time;
			this._clearCanvas();
			
			this.COL.draw();
			//clean cache
			if((now-this.cacheCleanTime)>5000){
				this.cacheCleanTime=now;
				if(this.COL_GraphCache.length>20){//save 20 cached danmaku
					for(let ti = 0;ti<this.COL_GraphCache.length;ti++){
						if((now-this.COL_GraphCache[ti].removeTime) > 10000){//delete cache which has live over 10s
							this.COL_GraphCache.splice(ti,1);
						}else{break;}
					}
				}
			}
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
			if(this.COL.debug.switch)return true;
			if(this.canvas.width*this.canvas.height/this.COL_DanmakuText.length<50000)return true;
			return false;
		}
		_clearCanvas(forceFull){
			if(forceFull||this._evaluateIfFullClearMode()){
				this.COL.clear();
				return;
			}
			let ctx=this.COL.context
			for(let t of this.COL_DanmakuText){
				if(t.drawn){
					ctx.clearRect(t.style.x-t.estimatePadding,t.style.y-t.estimatePadding,t._cache.width,t._cache.height);
				}else{t.drawn=true;}
			}
		}
		clear(){//clear danmaku on the screen
			for(let t of this.COL_DanmakuText){
				if(t.danmaku)this.removeText(t);
			}
			this.tunnel.reset();
			this._clearCanvas(true);
		}
		reCheckIndexMark(t=this.frame.time){
			this.indexMark=dichotomy(this.list,t,0,this.list.length-1,true);
		}
		time(t=this.frame.time){//reset time,you should invoke it when the media has seeked to another time
			this.reCheckIndexMark();
			if(this.options.clearWhenTimeReset){this.clear();}
			else{this.resetTimeOfDanmakuOnScreen();}
		}
		resetTimeOfDanmakuOnScreen(cTime=this.frame.time){
			//cause the position of the danmaku is based on time
			//and if you don't want these danmaku on the screen to disappear,their time should be reset
			for(let t of this.COL_DanmakuText){
				if(!t.danmaku)continue;
				t.time=cTime-(this.danmakuMoveTime-t.time);
			}
		}
		danmakuAt(x,y){//return a list of danmaku which is over this position
			const list=[];
			if(!this.enabled)return list;
			for(let t of this.COL_DanmakuText){
				if(!t.danmaku)continue;
				if(t.style.x<=x && t.style.x+t.style.width>=x && t.style.y<=y && t.style.y+t.style.height>=y)
					list.push(t.danmaku);
			}
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

export default init;