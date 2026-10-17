const normalize=trace=>(trace??[]).map(x=>({op:x.op,state:x.state,effect:x.effect??null,accepted:x.accepted===true}));
export function compareProviderShadowV1({referenceTrace,fakeTrace}={}){
  const a=normalize(referenceTrace),b=normalize(fakeTrace); const same=JSON.stringify(a)===JSON.stringify(b);
  return Object.freeze({schemaId:'PROVIDER_SHADOW_COMPARATOR_V1',status:same?'PASS':'FAIL',reference:a,fake:b,semanticMismatch:!same});
}
