const result={data:[],error:null};
const chain:unknown=new Proxy(()=>{}, {get(_t,key){if(key==='then')return Promise.resolve(result).then.bind(Promise.resolve(result));return ()=>chain;},apply(){return chain;}});
export const supabase={from:()=>chain,rpc:async()=>result,auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}})},functions:{invoke:async()=>result}};
