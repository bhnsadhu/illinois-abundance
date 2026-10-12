'use client';
import {useEffect} from 'react';
export function ViewCounter({postId}:{postId:string}){
  useEffect(()=>{void fetch('/api/views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postId}),keepalive:true}).catch(()=>{});},[postId]);
  return null;
}
