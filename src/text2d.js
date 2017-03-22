/*
Copyright luojia@luojia.me
LGPL license
*/
class Text2d{
	constructor(dText){
		this.dText=dText;
	}
	draw(force){
		//this.clear(force);
		let ctx=this.dText.context2d;
		for(let i=0,t,dT=this.dText,l=dT.DanmakuText.length;i<l;i++){
			t=dT.DanmakuText[i];
			t.drawn||(t.drawn=true);
			ctx.drawImage(t._bitmap?t._bitmap:t._cache, t.style.x-t.estimatePadding, t.style.y-t.estimatePadding);
		}
	}
	clear(force){
		let ctx=this.dText.context2d;
		if(force){
			ctx.clearRect(0,0,this.dText.canvas.width,this.dText.canvas.height);
			return;
		}
		for(let i=this.dText.DanmakuText.length,t;i--;){
			t=this.dText.DanmakuText[i];
			if(t.drawn){
				ctx.clearRect(t.style.x-t.estimatePadding,t.style.y-t.estimatePadding,t._cache.width,t._cache.height);
			}
		}
	}
}
export default Text2d;