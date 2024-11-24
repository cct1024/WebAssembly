/**
 * 1. 为了处理字符串及其他复杂数据类型，wasm提供了内存。
 * 2. 按照wasm的定义，内存就是一个随着时间增长的字节数组。wasm包含读取i32.load和i32.store指令实现对线性内存的读写。
 * 3. 从js的角度来看，内存就是一个arrayBuffer，并且它是可变大小的。从字面上来说，这也是asm.js所做的（除了它不能改变大小）。因此，一个字符串就是位于这个线性内存某处的字节序列。
 * 4. js能够通过WebAssembly.Memory()接口创建wasm线性内存实例，并且能够通过相关的实例方法获取已经存在的内存实例（当前每一个模块实例只能有一个内存实例）。内存实例拥有一个buffer获取器，它返回一个指向线性内存的arrayBuffer。
 * 5. 内存实例也能够增长。举例来说，在js中可以调用Memory.grow()方法。
 * 由于arrayBuffer不能改变大小，所以，当增长产生的时候，当前的arrayBuffer会被移除，并且一个新的arrayBuffer会被创建并指向新的、更大的内存。
 * 这意味着向js传递一个字符串，我们需要做的就是把字符串在线性内存中的偏移量，以及表示其长度的方法传递出去。
 * 6. 在wasm中，既可以使用js创建一个内存对象，让wasm模块导入这个内存，或者让wasm创建这个内存并把它导出给js。
 * 示例：(import "js" "memory" (memory 1)) 其中1表示要导入的内存必须至少有1页内存，wasm中定义1页为64kb。
 * 7. 在wasm中，可以使用数据(data)段把字符串内容写入到一个全局内存中。数据段允许字符串字节在实例化时被写在一个指定的偏移量。而且，它与原生的可执行格式中的数据(.data)段是类似的。
 * 8. new Uint8Array(memory.buffer,ptr,length)实例化的字节数组，底层指向的数据依然是memory.buffer，可以理解像go中的切片。因此，对bytes中的数据进行修改也将影响到memory.buffer中的数据。
 */
function consoleString(){
    WebAssembly.compileStreaming(fetch("base-memory.wasm")).then(mod=>{
        const memory = new WebAssembly.Memory({initial:1});
        const obj = new WebAssembly.Instance(mod,{
            console:{
                string:function(ptr,length){
                    console.log(ptr,length)
                    const bytes = new Uint8Array(memory.buffer,ptr,length);
                    const string = new TextDecoder('utf8').decode(bytes);
                    console.log(string)
                    bytes[0]=99;
                    console.log(bytes,memory.buffer)
                    console.log(new TextDecoder('utf8').decode(bytes))
                }
            },
            js:{
                memory:memory
            }
        });
        console.log(mod,obj)
        obj.exports.writeString()
    })
}
function main(){
    consoleString();
}
main();