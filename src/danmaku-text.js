/*
Copyright luojia@luojia.me
LGPL license

danmaku-frame text2d mod
*/
'use strict';

import CanvasObjLibrary from '../lib/COL/CanvasObjLibrary.js';

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
				strokeColor: "#000",
				shadowBlur: 5,
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
			this.COL.autoClear=false;
			frame.container.appendChild(this.canvas);
			this.COL_GraphCache=[];//COL text graph cache
			this.layer=new this.COL.class.FunctionGraph();//text layer
			this.COL.root.appendChild(this.layer);
			this.cacheCleanTime=0;
			this.danmakuMoveTime=0;
			//this._clearRange=[0,0];
			this.options={
				allowLines:false,//allow multi-line danmaku
				screenLimit:0,//the most number of danmaku on the screen
				clearWhenTimeReset:true,//clear danmaku on screen when the time is reset
				speed:5,
			}
		}
		start(){
			this.paused=false;
			this.resetTimeOfDanmakuOnScreen();
		}
		pause(){
			this.paused=true;
		}
		load(d){
			if(!d || d._!=='text'){return false;}
			let t=d.time,ind,arr=this.list;
			if(arr.length===0 || (t<arr[0].time))ind=0;
			else if(t>=arr[arr.length-1].time)ind=arr.length;
			else{ind=dichotomy(arr,d.time,0,arr.length-1,false)}
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
		draw(force){
			if(!this.enabled)return;
			//find danmaku from indexMark to current time
			if(!force&&((this.danmakuMoveTime==cTime)||this.paused))return;
			const cTime=this.frame.time,
					cHeight=this.COL.canvas.height,
					cWidth=this.COL.canvas.width,
					ctx=this.COL.context;
			let t,d;
			if(!force&&this.list.length)
			for(;(d=this.list[this.indexMark])&&(d.time<=cTime);this.indexMark++){//add new danmaku
				if(this.options.screenLimit>0 && this.layer.childNodes.length>=this.options.screenLimit)break;//break if the number of danmaku on screen has up to limit
				if(document.hidden)continue;
				d=this.list[this.indexMark];
				t=this.COL_GraphCache.length?
					this.COL_GraphCache.shift():
					new this.COL.class.TextGraph();
				t.onoverCheck=false;
				t.danmaku=d;
				t.drawn=false;
				t.text=this.allowLines?d.text:d.text.replace(/\n/g,' ');
				t.time=cTime;
				t.font=Object.create(this.defaultStyle);
				Object.assign(t.font,d.style);
				t.style.opacity=t.font.opacity;

				t.prepare();
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
				if(d.mode>1)t.style.x=(cWidth-t.style.width)/2;
				this.layer.appendChild(t);
			}

			//const cRange=this._clearRange;
			//calc all danmaku's position
			this.danmakuMoveTime=cTime;
			this._clearCanvas();
			for(t of this.layer.childNodes){
				switch(t.danmaku.mode){
					case 0:case 1:{
						const Mright=!t.danmaku.mode;
						t.style.x=(Mright?(cWidth+t.style.width):(-t.style.width))
									+(Mright?-1:1)*this.frame.rate*520*(cTime-t.time)/this.options.speed/1000;
						if((Mright&&t.style.x<-t.style.width) || (!Mright&&t.style.x>cWidth+t.style.width)){//go out the canvas
							this.removeText(t);
						}else if(t.tunnelNumber>=0 && ((Mright&&(t.style.x+t.style.width)+30<cWidth) || (!Mright&&t.style.x>30))){
							this.tunnel.removeMark(t);
						}
						break;
					}
					case 2:case 3:{
						if((cTime-t.time)>this.options.speed*1000/this.frame.rate){
							this.removeText(t);
						}
					}
				}
			}
			this.COL.draw();
			//clean cache
			if((Date.now()-this.cacheCleanTime)>5000){
				this.cacheCleanTime=Date.now();
				if(this.COL_GraphCache.length>20){//save 20 cached danmaku
					for(let ti = 0;ti<this.COL_GraphCache.length;ti++){
						if((Date.now()-this.COL_GraphCache[ti].removeTime) > 10000){//delete cache which has live over 10s
							this.COL_GraphCache.splice(ti,1);
						}else{break;}
					}
				}
			}
		}
		_evaluateIfFullClearMode(){
			return false;
		}
		_clearCanvas(forceFull){
			if(forceFull||this._evaluateIfFullClearMode()){
				this.COL.clear();
				return;
			}
			let ctx=this.COL.context
			for(let t of this.layer.childNodes){
				if(t.drawn){
					ctx.clearRect(t.style.x-t.estimatePadding,t.style.y-t.estimatePadding,t._cache.width,t._cache.height);
				}else{t.drawn=true;}
			}
		}
		removeText(t){//remove the danmaku from screen
			this.layer.removeChild(t);
			this.tunnel.removeMark(t);
			t.danmaku=null;
			t.removeTime=Date.now();
			this.COL_GraphCache.push(t);
		}
		resize(){
			this.COL.adjustCanvas();
			this.draw(true);
		}
		clear(){//clear danmaku on the screen
			for(let t of this.layer.childNodes){
				if(t.danmaku)this.removeText(t);
			}
			this.tunnel.reset();
			this._clearCanvas(true);
		}
		time(t){//reset time,you should invoke it when the media has seeked to another time
			this.indexMark=dichotomy(this.list,t,0,this.list.length-1,true);
			if(this.options.clearWhenTimeReset){this.clear();}
			else{this.resetTimeOfDanmakuOnScreen();}
		}
		resetTimeOfDanmakuOnScreen(cTime=this.frame.time){
			//cause the position of the danmaku is based on time
			//and if you don't want these danmaku on the screen to disappear,their time should be reset
			for(let t of this.layer.childNodes){
				if(!t.danmaku)continue;
				t.time=cTime-(this.danmakuMoveTime-t.time);
			}
		}
		danmakuAt(x,y){//return a list of danmaku which is over this position
			const list=[];
			if(!this.enabled)return list;
			for(let t of this.layer.childNodes){
				if(!t.danmaku)continue;
				if(t.x<=x && t.x+t.style.width>=x && t.y<=y && t.y+t.style.height>=y)
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
			tobj.tunnelHeight=((tobj.style.y+size)>cHeight)?cHeight-tobj.style.y-1:size;
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
		let m,e=end;
		while(start < end){//dichotomy
			m=(start+end)>>1;
			if(t>=arr[m].time)start=m+1;
			else{end=m;}
		}
		if(position){
			while(start<e && (arr[start+=1].time===arr[start].time)){}
		}else{
			while(start>0 && (arr[start-1].time===arr[start].time)){
				start-=1;
			}
		}
		return start;
	}

	DanmakuFrame.addModule('text2d',Text2D);
};


export default init;