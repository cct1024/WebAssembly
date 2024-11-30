/**
 * 1. WebAssembly.Global对象表示一个全局变量实例，可以被Javascript和importable/exportable访问，跨越一个或多个WebAssembly.Module实例。他允许被多个模块动态连接。
 * 2. 至此table memory global三种类型实例都是可补共享的！
 * 3. global实例需要指定value类型，也可以指定是否可修改，mutable如果为false则为只读，mutable默认值为false
 * 4. 切记import必须写在最前面
 */
function baseGlobal() {
    const g1 = new WebAssembly.Global({ value: 'i32', mutable: true })
    const g2 = new WebAssembly.Global({ value: 'i32' })
    g1.value = 123;
    // g2.value=456
    console.log(g1, g1.value, g2.value)
}
async function exportGlobal() {
    const age = new WebAssembly.Global({value:'i32',mutable:true})
    const {module,instance} = await WebAssembly.instantiateStreaming(fetch('base-global.wasm'),{js:{age}})
    console.log(module,instance)
    console.log(instance.exports.ID.value)
    // 只读全局变量不可修改
    // instance.exports.ID.value=888
    console.log(instance.exports.ID.value)
    console.log(instance.exports.Level.value)
    instance.exports.Level.value=888
    console.log(instance.exports.Level.value)
    console.log(instance.exports.getAge())
    instance.exports.setAge(123)
    console.log(instance.exports.getAge())
}
async function main() {
    await baseGlobal()
    await exportGlobal()
}
main()