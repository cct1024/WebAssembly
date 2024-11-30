/**
 * 1. Tag用于创建一个标签，该标签通过wasm抛出异常时对外抛出，类似Error对象
 * 2. 这个功能比较新，wat无法编译throw指令
 */
async function thorwError() {
    const tag1 = new WebAssembly.Tag({parameters:['i32']})
    const {module,instance} = await WebAssembly.instantiateStreaming(fetch('base-exception.wasm'),{
        js:{
            tag:tag1
        }
    })
    console.log(tag1)
    try{
        instance.exports.run()
    }catch(e){
        // wasm抛出了异常是tag对象，其支持is方法判断是否是某个异常类型
        if(e.is(tag1)){
            // 通过tag的getArg方法可以获取该tag所保存的参数，通过tag及索引获取指定的参数
            // 假使错误信息保存在内存中，可以抛出一个tag并保存内存的指针和字节长度，然后取出错误信息
            // 即使不抛出异常也可以通过其它手段实现将错误信息向外传递
            console.log('msg: ',e.getArg(tag1,0))
        }
    }
}
async function main() {
    await thorwError()
}
main()