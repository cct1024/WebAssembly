self.addEventListener('message',async e=>{
    const mod = e.data;
    const obj = await WebAssembly.instantiate(mod,{
        imports:{
            import_func(a){
                console.log(a)
            }
        }
    })
    console.log(obj)
    obj.exports.exported_func();
})