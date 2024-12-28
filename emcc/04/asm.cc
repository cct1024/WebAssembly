#include <stdio.h>
#include <iostream>
// emcc asm.cc -s WASM=0 -o asm.js -s SAFE_HEAP=1
struct  ST
{
    uint8_t c[4];
    float f;
};
int main(){
    // 创建char * 类型指针，申请100个字节的内存
    char * buf=(char*)malloc(100);
    // 创建ST类型的指针，但是将buf偏移2作为pst的指针地址
    // char类型的指针与ST指针类型并不相同，char类型指针每位移一个指向下一个char类型数据
    // 而st指针类型应该指向一个能存储4个uint8类型及一个float类型的指针地址
    ST * pst = (ST*)(buf+2);
    // 数组中的每个元素都是uint8类型，所以指针位置也没有问题
    pst->c[0] = pst->c[1] = pst->c[2] = pst->c[3] = 123;
    // 但是运行到这句时，编译为asm.js时，使用的是pstc->c[3]的地址进行偏移的，基于uint8类型地址右移8位也无法读取到正确的float类型的数据
	pst->f = 3.14f;
	printf("c[0]:%d,c[1]:%d,c[2]:%d,c[3]:%d,f:%f\n",
		pst->c[0], pst->c[1], pst->c[2], pst->c[3], pst->f);

	free(buf);
	return 0;
}
