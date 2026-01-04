use serde_json::{Value, Map};
pub fn canonicalize(value:&Value)->Value{
  fn inner(v:&Value)->Value{
    match v {
      Value::Object(m)=>{
        let order=["id","ts","kind","scope","actor","refs","data","meta","sig"];
        let mut out=Map::new();
        for k in order {
          if let Some(val)=m.get(k){ out.insert(k.to_string(), inner(val)); }
        }
        let mut rest:Vec<_>=m.keys().filter(|k|!order.contains(&k.as_str())).cloned().collect();
        rest.sort_unstable();
        for k in rest { if let Some(val)=m.get(&k){ out.insert(k, inner(val)); } }
        Value::Object(out)
      },
      Value::Array(a)=>Value::Array(a.iter().map(inner).collect()),
      _=>v.clone()
    }
  }
  inner(value)
}
