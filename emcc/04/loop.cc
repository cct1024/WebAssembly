#include "macro.cc"
#include <emscripten.h>
#include <stdio.h>
#include <time.h>
// emcc loop.cc -o loop.js
EM_PORT_API(void) setp(){
    static int count = 0;
    static long cb=clock();
    long t = clock();
    if(t-cb>=CLOCKS_PER_SEC){
        cb=t;
		printf("current clock:%ld, current fps:%d\n", t, count);
        t=0;
    }
    count++;
}