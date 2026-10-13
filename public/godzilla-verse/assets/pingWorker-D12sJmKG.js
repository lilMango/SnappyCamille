self.onmessage=l=>{const{id:a,buffer:e}=l.data,s=new Uint8Array(e);let t=0;for(let n=0;n<s.length;n++)t=t+s[n]|0;self.postMessage({id:a,sum:t,length:s.length,buffer:e},[e])};
