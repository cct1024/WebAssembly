#include "macro.cc"
#include <stdio.h>
// emcc main.cc -o main.js
// emcc main.cc -s NO_EXIT_RUNTIME=0 -o main.js
EM_PORT_API(int)
add(int a, int b)
{
    return a + b;
}
int main()
{
    printf("你好，世界！\n");
    return 0;
}