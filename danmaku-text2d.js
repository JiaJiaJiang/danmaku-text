/*
Copyright luojia@luojia.me
LGPL license

danmaku-frame text2d mod
*/
'use strict';

(function(){
	class Text2D extends DanmakuFrameModule{
		constructor(frame){
			super(frame);
			this.list=[];
			this.indexMark=0;
			this.resetTunnel();
			this.defaultStyle={
				fontStyle: null,
				fontWeight: 600,
				fontVariant: null,
				color: "#fbfbfb",
				lineHeight: null,
				fontSize: 30,
				fontFamily: "Arial",
				strokeWidth: 1,
				strokeColor: "#000",
				shadowBlur: 10,
				shadowColor: "#000",
				shadowOffsetX:0,
				shadowOffsetY:0,
				fill:true,
				reverse:false,
				speed:5,
				opacity:1,
			};
			this.COL_GraphCache=[];//COL text graph cache
			this.layer=new this.frame.COL.class.FunctionGraph();//text layer
			this.frame.COL.root.appendChild(this.layer);
			this.cacheCleanTime=0;
			this.options={
				allowLines:false,
			}
		}
		load(d){
			if(!d || d._!=='text')return false;
			this.list.push(d);//add to list
			this.list.sort((pre,aft)=>{return pre.time>aft.time;});//sort by time
			return true;
		}
		unload(d){
			if(!d || d._!=='text')return false;
			const i=this.list.indexOf(d);
			if(i<0)return false;
			this.list.splice(i,1);
			return true;
		}
		resetTunnel(){
			this.tunnels={
				right:[],
				left:[],
				bottom:[],
				top:[],
			};
		}
		draw(){
			if(!this.enabled)return;
			//find danmaku from indexMark to current time
			const cTime=this.frame.time,
					cHeight=this.frame.COL.canvas.height,
					cWidth=this.frame.COL.canvas.width;
			let t,d;
			for(;this.list[this.indexMark].time<=cTime;this.indexMark++){//add new danmaku
				d=this.list[this.indexMark];
				t=this.COL_GraphCache.length?
					this.COL_GraphCache.shift():
					new this.frame.COL.class.TextGraph();
				t.danmaku=d;
				t.text=this.allowLines?d.text:d.text.replace(/\n/g,' ');
				t.time=d.time;
				t.font=Object.create(this.defaultStyle);
				Object.assign(t.font,d.style);
				t.style.opacity=t.font.opacity;

				t.prepare();
				//find tunnel number
				const size=t.style.height,tnum=this.getTunnel(d.tunnel,size);
				t.tunnelNumber=tnum;
				//calc margin
				let margin=(tnum<0?0:tnum)%cHeight;
				t.style.setPositionPoint(t.style.width/2,0);
				switch(d.tunnel){
					case 0:case 1:case 3:{
						t.style.top=margin;break;
					}
					case 2:{
						t.style.top=cHeight-margin;
					}
				}
				
				tunnel[tnum]=((t.style.top+size)>cHeight)?
								cHeight-t.style.top-1:
								size;
				this.layer.appendChild(t);
			}
			//calc all danmaku's position
			for(t of this.layer.childNodes){
				switch(t.danmaku.tunnel){
					case 0:case 1:{
						const direc=t.danmaku.tunnel;
						t.style.x=(direc?(cWidth+t.style.width/2):(-t.style.width/2))
									+(direc?-1:1)*520*(cTime-t.time)/t.font.speed/1000;
						if((direc||t.style.x<-t.style.width) || (direc&&t.style.x>cWidth+t.style.width)){//go out the canvas
							this.removeText(t);
						}else if(t.tunnelNumber>=0 && ((direc||(t.style.x+t.style.width/2)+30<cWidth) || (direc&&(t.style.x-t.style.width/2)>30))){
							delete this.tunnels[tunnels[t.danmaku.tunnel]][t.tunnelNumber];
							t.tunnelNumber=-1;
						}
						break;
					}
					case 2:case 3:{
						t.style.x=cWidth/2;
						if((cTime-t.time)>t.font.speed*1000){
							this.removeText(t);
						}
					}
				}
			}
			//clean cache
			if((Date.now()-this.cacheCleanTime)>5000){
				this.cacheCleanTime=Date.now();
				if(this.COL_GraphCache.length>20){//save 20 cached danmaku
					for(let ti = 0;ti<this.COL_GraphCache.length;ti++){
						if((Date.now()-this.COL_GraphCache[ti].removeTime) > 10000){//delete cache over 10s
							this.COL_GraphCache.splice(ti,1);
						}else{break;}
					}
				}
			}
		}
		getTunnel(tid,size){
			let tunnel=this.tunnels[tunnels[tid]],tnum=-1,ti=0,
				cHeight=this.frame.COL.canvas.height;
			if(size>cHeight)return -1;

			while(tnum<0){
				for(let i2=0;i2<size;i2++){
					if(tunnel[ti+i2]!==undefined){//used
						ti+=i2+tunnel[ti+i2];
						break;
					}else if(((ti+i2)%cHeight)===0){//new page
						ti+=i2;
						break;
					}else if(i2===size-1){//get
						tnum=ti;
						break;
					}
				}

			}
			return tnum;
		}
		removeText(t){
			this.layer.removeChild(t);
			t.danmaku=null;
			(t.tunnelNumber>=0)&&(delete this.tunnels[tunnels[t.danmaku.tunnel]][t.tunnelNumber]);
			t.removeTime=Date.now();
			this.COL_GraphCache.push(t);
		}
		clear(){
			for(t of this.layer.childNodes){
				if(t.danmaku)this.removeText(t);
			}
			this.resetTunnel();
		}
		time(t){
			this.indexMark=dichotomy(this.list,t,0,this.list.length-1);
			this.clear();
		}
		enable(){
			this.layer.style.hidden=false;
		}
		disable(){
			this.layer.style.hidden=true;
			this.clear();
		}
	}

	const tunnels=['right','left','bottom','top'];

	function dichotomy(arr,t,start,end){
		if(arr.length===0)return -1;
		let m;
		while(start <= end){
			m=(start+end)>>1;
			if(t<=arr[m].time)start=m;
			else end=m-1;
		}
		while(arr[start-1] && (arr[start-1].time===arr[start].time))
			start--;
		return start;
	}

	DanmakuFrame.addModule('text2d',Text2D);
})();