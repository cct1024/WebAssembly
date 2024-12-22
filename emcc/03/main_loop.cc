#include "macro.cc"
#include <stdio.h>
// emcc main_loop.cc -o main_loop.js
/**
 * 1. void emscripten_set_main_loop(em_callback_func func,int fps, int simulate_inifinite_loop)，参数：
 * func: 消息处理回调函数
 * fps: 消息循环的执行帧率。如果该参数<=0，则使用页面的requestAnimationFrame机制调用消息处理函数，该机制可以确保页面刷新率与显示器刷新率对齐，对于需要执行图形渲染任务的程序，使用该机制可以得到平滑的渲染速度。
 * simulate_infinite_loop: 是否模拟无限循环
 * 2. 如果simulate_infinite_loop设置为1模拟了无限循环，那么执行循环代码之后的代码就无法运行，因为无限循环阻塞了代码的执行。如果不启用无限循环后面的代码可以立即执行。
 * 3. 模拟无限循环的逻辑大概是通过定时器实现的，如果模拟了循环则不使用定时器直接运行，自然就会阻塞代码。
 * 4. 消息循环的暂停、继续以及终止：emscripten_pause_main_loop、emscripten_resuce_main_loop、emscripten_cancel_main_loop
 */
void msg_loop()
{
    static int count = 0;
    if (count % 60 == 0)
    {
        printf("count:%d\n", count);
    }
    count++;
}

int main()
{
    printf("main() start\n");
    // 设置主循环函数，帧率未指定使用默认的requestAnimationFrame机制
    emscripten_set_main_loop(msg_loop, 0, 1);
    printf("main() end\n");
    return 0;
}
EM_PORT_API(void)
pause_loop()
{
    emscripten_pause_main_loop();
}
EM_PORT_API(void)
resume_loop()
{
    emscripten_resume_main_loop();
}
EM_PORT_API(void)
cancel_loop()
{
    emscripten_cancel_main_loop();
}