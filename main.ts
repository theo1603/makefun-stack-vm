// A complete interpreter for make.fun's tiny stack ISA (v1): wrapping 32-bit
// arithmetic, all ten traps with their exact exit codes, and the step and
// output limits. One run answers every instance under the input directory.
import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

function run(p,q){
  const n=p.length,D=new Int32Array(256),C=new Int32Array(64),M=new Int32Array(256),O=new Uint8Array(65536);
  let s=0,k=0,pc=0,ip=0,ol=0,st=0;
  const trap=c=>({o:O.slice(0,ol),c});
  for(;;){
    if(st===1e6)return trap(10);
    if(pc<0||pc>=n)return trap(9);
    const op=p[pc];
    const ok=op<8||op>=0x10&&op<=0x22&&op!==0x1f||op>=0x30&&op<=0x34||op===0x40||op===0x41||op>=0x50&&op<=0x53;
    if(!ok)return trap(5);
    const im=op===1?1:op===2?4:op>=0x30&&op<=0x33?2:0;
    if(pc+im>=n)return trap(9);
    st++;
    const nx=pc+1+im;
    pc=nx;
    if(op>=0x10&&op<=0x22){
      if(op===0x17||op===0x1b){
        if(s<1)return trap(2);
        D[s-1]=op===0x17?-D[s-1]|0:~D[s-1];
        continue;
      }
      if(s<2)return trap(2);
      const b=D[s-1],a=D[s-2];
      let r=0;
      if(op===0x10)r=a+b|0;
      else if(op===0x11)r=a-b|0;
      else if(op===0x12)r=Math.imul(a,b);
      else if(op===0x13){if(!b)return trap(4);r=a===-2147483648&&b===-1?a:a/b|0;}
      else if(op===0x14){if(!b)return trap(4);r=b===-1?0:a%b|0;}
      else if(op===0x15){if(!b)return trap(4);r=Math.floor((a>>>0)/(b>>>0))|0;}
      else if(op===0x16){if(!b)return trap(4);r=(a>>>0)%(b>>>0)|0;}
      else if(op===0x18)r=a&b;
      else if(op===0x19)r=a|b;
      else if(op===0x1a)r=a^b;
      else if(op===0x1c)r=a<<(b&31);
      else if(op===0x1d)r=a>>(b&31);
      else if(op===0x1e)r=a>>>(b&31)|0;
      else if(op===0x20)r=a===b?1:0;
      else if(op===0x21)r=a<b?1:0;
      else r=(a>>>0)<(b>>>0)?1:0;
      s-=2;
      D[s++]=r;
      continue;
    }
    switch(op){
      case 0:return{o:O.slice(0,ol),c:0};
      case 1:if(s>=256)return trap(3);D[s++]=(p[nx-1]<<24)>>24;break;
      case 2:if(s>=256)return trap(3);D[s++]=p[nx-4]|p[nx-3]<<8|p[nx-2]<<16|p[nx-1]<<24;break;
      case 3:if(s<1)return trap(2);s--;break;
      case 4:if(s<1)return trap(2);if(s>=256)return trap(3);D[s]=D[s-1];s++;break;
      case 5:{if(s<2)return trap(2);const t=D[s-1];D[s-1]=D[s-2];D[s-2]=t;break;}
      case 6:if(s<2)return trap(2);if(s>=256)return trap(3);D[s]=D[s-2];s++;break;
      case 7:{if(s<3)return trap(2);const a=D[s-3];D[s-3]=D[s-2];D[s-2]=D[s-1];D[s-1]=a;break;}
      case 0x30:pc=nx+((p[nx-2]|p[nx-1]<<8)<<16>>16);break;
      case 0x31:case 0x32:{
        if(s<1)return trap(2);
        const v=D[--s],rel=((p[nx-2]|p[nx-1]<<8)<<16)>>16;
        if(op===0x31?v===0:v!==0)pc=nx+rel;
        break;
      }
      case 0x33:if(k===64)return trap(7);C[k++]=nx;pc=p[nx-2]|p[nx-1]<<8;break;
      case 0x34:if(k===0)return trap(8);pc=C[--k];break;
      case 0x40:{if(s<1)return trap(2);const a=D[s-1];if(a<0||a>255)return trap(6);D[s-1]=M[a];break;}
      case 0x41:{if(s<2)return trap(2);const a=D[s-1];if(a<0||a>255)return trap(6);M[a]=D[s-2];s-=2;break;}
      case 0x50:{
        if(s<1)return trap(2);
        const t=String(D[s-1]);
        if(ol+t.length>65536)return trap(11);
        for(let i=0;i<t.length;i++)O[ol++]=t.charCodeAt(i);
        s--;
        break;
      }
      case 0x51:if(s<1)return trap(2);if(ol>=65536)return trap(11);O[ol++]=D[--s]&255;break;
      case 0x52:if(s>=256)return trap(3);D[s++]=ip<q.length?q[ip++]:-1;break;
      case 0x53:if(s<1)return trap(2);return{o:O.slice(0,ol),c:D[--s]&255};
    }
  }
}

const rd=(d,f)=>{try{return new Uint8Array(readFileSync(join(d,f)))}catch{return new Uint8Array(0)}};
const I=process.env.MAKEFUN_INPUT_DIR??'/input',O=process.env.MAKEFUN_OUTPUT_DIR??'/output';
for(const id of readdirSync(I).sort()){
  const d=join(I,id),o=join(O,id);
  let r={o:new Uint8Array(0),c:0};
  try{r=run(rd(d,'program.bin'),rd(d,'input.bin'));}catch{}
  try{
    mkdirSync(o,{recursive:true});
    writeFileSync(join(o,'stdout.bin'),r.o);
    writeFileSync(join(o,'exit.txt'),r.c+'\n');
  }catch{}
}
