/*
Copyright luojia@luojia.me
LGPL license
*/

class TextCanvas{
	constructor(dText){
		this.dText=dText;
		this.supported=dText.text2d.supported;
	}
	draw(force){
		const gl=this.gl,l=this.dText.DanmakuText.length;
		for(let i=0,t;i<l;i++){
			t=this.dText.DanmakuText[i];
			t._cache.style.transform=`translate3d(${t.style.x-t.estimatePadding}px,${t.style.y-t.estimatePadding}px,0)`;
		}
	}
	clear(){}
	remove(t){
		this.dText.textCanvasContainer.removeChild(t._cache);
	}
	hide(){
		this.dText.textCanvasContainer.hidden=true;
	}
	newDanmaku(t){
		t._cache.style.transform=`translate3d(${t.style.x-t.estimatePadding}px,${t.style.y-t.estimatePadding}px,0)`;
		this.dText.textCanvasContainer.appendChild(t._cache);
	}
}
export default TextCanvas;
