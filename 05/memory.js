/**
 * 1. 在wasm中进行数据读写时，要注意写入的字节数与内存的偏移量。i32类型占4字节，所以内存位置要*4
 * 2. 由于i32类型是有符号类型，所以i32无法读取u32的数据，只能读取到u8 u16以及有符号的8位和16位数据。如果想要u32只能用i64来存储，但也意味着没有u64的数据可以读取
 * 3. 在保存数据类型时不能指定有符号或无符号，在读取数据时则可以指定是有符号还是无符号，如果存入的是有符号类型但通过无符号读取，那么其转换就是数据类型转换，符合所有编程的数据类型转换规则，即有符号转无符号或无符号转有符号的逻辑。
 * 4. 通过Memory.grow(n)可以调整内存大小，n表示多少页，每页64KB。只要调整了内存大小，即使调整前后大小不变，也会创建新的内存并拷贝原有的数据。
 * 5. 当内存大小调整后需要通过memory.buffer获取最新的数据，原内存数据将被清空!
 */
async function writeData() {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const u8 = new Uint8Array(memory.buffer, 0, 32)
    const { module, instance } = await WebAssembly.instantiateStreaming(fetch('base-memory.wasm'), {
        js: {
            mem: memory
        }
    });
    const str = "hello";
    // 循环将每个字符写入内存
    for (let i = 0; i < str.length; i++) {
        instance.exports.writeu8(i, str.charCodeAt(i))
        console.log(instance.exports.readu8(i))
    }
    // 可以从内存中截取写入的部分并解析为字符串
    console.log(module, instance, memory, u8, new TextDecoder().decode(u8.slice(0, str.length)));
}
async function write32() {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const u8 = new Uint8Array(memory.buffer, 0, 64)
    const { module, instance } = await WebAssembly.instantiateStreaming(fetch('base-memory.wasm'), {
        js: {
            mem: memory
        }
    });
    // 写入999
    instance.exports.write32(0, 999)
    // 读取u32数值
    console.log(instance.exports.read32(0), u8)
    // 第二次操作的内存位置为1，由于写的是4字节未进行内存偏移，导致第一次写入的数据被抹掉一部分
    instance.exports.write32(1, 888)
    // 读取第一次写入的数据就错了，那是一份脏数据了
    console.log(instance.exports.read32(1), instance.exports.read32(0))
    // 使用正确的方法重新进行32位数值的读写吧
    instance.exports.set32(0, 888)
    instance.exports.set32(1, 999)
    console.log(instance.exports.get32(0), instance.exports.get32(1), u8)
    // 写入1字节数值
    instance.exports.set8(9, -120);
    console.log(instance.exports.gets8(9), instance.exports.getu8(9), u8)
}
async function memoryGrow() {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const u8 = new Uint8Array(memory.buffer, 0, 4)
    const buf1 = memory.buffer;
    const { module, instance } = await WebAssembly.instantiateStreaming(fetch('base-memory.wasm'), {
        js: {
            mem: memory
        }
    });
    instance.exports.set8(0,123)
    memory.grow(1)

    const buf2 = memory.buffer;
    console.log(instance,instance.exports.getu8(0))
    console.log(1111,u8.length,new Uint8Array(memory.buffer,0,4))
    instance.exports.set8(0,124)
    console.log(2222,new Uint8Array(memory.buffer,0,4))
    console.log(buf1==buf2)
}
async function main() {
    await writeData();
    await write32();
    await memoryGrow();
}
main();