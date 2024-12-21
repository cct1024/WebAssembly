#include "macro.cc"
#include <stdio.h>
#include <malloc.h>

//  -s NO_EXIT_RUNTIME=0 参数可以用来解决无法使用main函数打印的问题以及无法使用printf的问题
EM_PORT_API(void)print_int(int a){
	printf("C{print_int() a:%d}\n", a);
}

EM_PORT_API(void)print_double(double a){
	printf("C{print_double() a:%lf}\n", a);
}

EM_PORT_API(void)print_float(float a){
	printf("C{print_float() a:%f}\n", a);
}
EM_PORT_API(void)js_print_fibonacci(int *ptr, int count);

EM_PORT_API(int *)fibonacci(int count){
    if (count<=0){
        return NULL;
    }
    // 创建一个int类型指针并分配了count*4的容量
    int * re = (int *)malloc(count*4);
    if (NULL == re){
        // 如果内存分配失败则re为空指针
		printf("Not enough memory.\n");
		return NULL;
    }
    re[0]=1;
    int i0=0,i1=1;
    for(int i =1;i<count;++i){
        re[i]=i0+i1;
        i0=i1;
        i1=re[i];
    }
    js_print_fibonacci(re,count);
    return re;
}
// 通过智能指针进行内存释放
EM_PORT_API(void) free_buf(void * buf){
    free(buf);
}

EM_PORT_API(int) sum(int * ptr, int cout){
    int total = 0;
    for(int i = 0; i<cout;++i){
        total+=ptr[i];
    }
    return total;
}
EM_PORT_API(const char *)get_string(){
    const char * str = "hello world! 你好，世界！";
    return str;
}
EM_PORT_API(void)print_string(const char * str){
    printf("%s\n",str);
}