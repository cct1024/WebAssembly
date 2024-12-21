#include "macro.cc"
#include <stdio.h>
int global_int = 42;
double global_double = 3.1415926;
// 返回int指针
EM_PORT_API(int*)get_int_ptr(){
    return &global_int;
}
// 返回double指针
EM_PORT_API(double*)get_double_ptr(){
    return &global_double;
}
// 打印指针地址
EM_PORT_API(void)print_data(){
    printf("C{global_int:%d}",global_int);
    printf("C{global_double:%lf}",global_double);
}
