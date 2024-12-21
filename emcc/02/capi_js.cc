#include "macro.cc"
/**
 * 1. 由于声明的两个函数是由js实现的，因此在编译时要使用--js-library xx.js指定实现这些函数的js库文件，如果未指定就会出现链接错误。
 * 2. 在js中向C导入函数需要调用特定的方法才能实现，参见capi_js_library.js
 */
EM_PORT_API (int) js_add(int a, int b);
EM_PORT_API(void) js_console_log_int(int param);
EM_PORT_API(void) print_the_answer(){
    int a = js_add(11,22);
    js_console_log_int(a);
}