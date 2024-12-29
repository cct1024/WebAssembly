function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.onload = resolve;
        script.onerror = reject;
        script.src = url;
        document.body.appendChild(script);
    })
}
/**
 * 1. 网络请求部分就是wasm调用js间接实现网络请求
 * 2. 所以重点还是基础部分，处理好js与C/C++之间的通信问题，尤其是复杂类型数据的传输与内存回收
 * 3. websocket稍微麻烦一些，但原理也一致，由js负责通信，C/C++设置消息处理函数即可
 */