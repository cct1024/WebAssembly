#include <emscripten.h>
#include <stdio.h>
// emcc em_macro.cc -s NO_EXIT_RUNTIME=0 -o em_asm.js
/**
 * 1. EM_ASM_支持输入数值类型的可变参数，同时返回整数类型的结果。EM_ASM_宏嵌入的js代码必须放到{}包围的代码块中（以区隔代码与参数），且至少必须含有一个输入参数。嵌入的js代码通过$n访问第n+1个参数。
 * 2. EM_ASM_宏嵌入js代码时，参数不仅可以是常数，也可以是变量
 * 3. EM_ASM_DOUBLE用法与EM_ASM_基本一致，区别是其返回值为double类型。
 * 4. EM_ASM_/EM_ASM_DOUBLE宏中嵌入的js代码会被展开为一个独立的js代码，因此在嵌入的js中除了用$n之外，也可以用内置的arguments对象来访问参数
 * 5. 其实所谓的嵌入js代码就是动态创建了js代码字符串，最后被一起打包到了胶水代码里。当你需要使用到C/C++内部的数据动态创建js代码时才需要这种方式，否则大可不必。以下是胶水代码中的样子：var ASM_CONSTS = {
  68492: () => { console.log('你好,js'); console.log('你好,window', window); },
 68556: ($0, $1, $2) => { return $0 + $1 + $2; },
 68581: ($0) => { console.log('sum: ', $0); },
 68611: ($0, $1) => { console.log('double: ', $0, $1); }
};
至于为什么有以数字为key，那些应该是在内存中的指针，如果猜的没错的话，这些函数会放在table中，通过指针就可以调用到这些函数。
6. 如果嵌入的js代码不需要参数，可以使用EM_ASM_INT_V/EM_ASM_DOUBLE_V宏。由于没有参数，嵌入的代码无需用{}包围。
 */

/**
 * 1. EM_ASM系列宏只能接受硬编码常量字符串，而emscripten_run_script系列函数可以接受动态输入的字符串，该系列辅助函数可以类比于js中的eval方法。
 * 2. 实际上该方法在胶水层代码中定义了，其就是调用了js的eval方法。
 * 3. emscripten_run_script_int()函数是有返回值的
 * 4. emscripten_run_script_string自然是返回字符串类型了。背后必然是胶水代码将字符串的返回值放进了内存，所以在C中得到的是指针。
 */
void run_script()
{
    emscripten_run_script("console.log(42)");
    const char *code = "console.log(this)";
    // 它接收的类型就是指针类型，其会通过指针读取字符串然后再调用eval方法。
    emscripten_run_script(code);
    // 多行字符串可以使用R"()"，这也是C++11新增的语法
    emscripten_run_script(R"(
        console.log(123);
        console.log(456);
    )");
    // 稍微要注意的是整个代码块放在eval中运行的，并不能直接使用return，因为return只能在函数中
    // eval将最后一行的结果作为返回值的，所以在最后可以执行一个函数，函数内有返回值即可，或者最后一句是个值也可以的
    int num = emscripten_run_script_int(R"(
        console.log('return 110');
        function demo(){
            return 110;
        }
        demo();
    )");
    int num2 = emscripten_run_script_int(R"(
        console.log('return 119');
        119;
    )");
    printf("num:%d\n", num);
    printf("num2:%d\n", num2);
    const char *str = emscripten_run_script_string(R"(
        var a = 'hello';
        var b = 'world';
        a+' ' + b;
    )");
	printf("%s\n", str);
}

int main()
{
    EM_ASM(
        console.log('你好,js');
        console.log('你好,window', window););
    // 嵌入js函数，并向函数传递3个参数，通过$n获取参数
    int sum = EM_ASM_({ return $0 + $1 + $2; }, 1, 2, 3);
    printf("sum(1, 2, 3): %d\n", sum);
    // 使用变量作为参数
    EM_ASM_({ console.log('sum: ', $0); }, sum);
    //
    double f1 = 1.23;
    EM_ASM_DOUBLE({ console.log('double: ', $0, $1); }, 1.0, f1);
    int answer = EM_ASM_INT_V(return 567);
    printf("The answer is:%d\n", answer);
    // 由于宏里面的是js的代码，其执行结果可以在c中使用，也就验证了刚才的猜测
    // 在编译的wasm中，嵌入的js函数放在了table中，而在c中调用js函数其实就是wasm中调用js函数，也就是通过table来调用
    double pi_js = EM_ASM_DOUBLE_V(return 3.14159);
    printf("PI:%lf\n", pi_js);
    run_script();
    return 0;
}