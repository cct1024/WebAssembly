#include "macro.cc"
#include <stdio.h>
#include <memory.h>
// emcc call_wrap.cc -s "EXTRA_EXPORTED_RUNTIME_METHODS=['ccall', 'cwrap']" -o call_wrap.js
EM_PORT_API(double)
add(double a, int b)
{
    return a + (double)b;
}
EM_PORT_API(void)
print_string(const char *str)
{
    printf("C:print_string(): %s\n", str);
}
EM_PORT_API(int)
sum(uint8_t *ptr, int count)
{
    int total = 0;
    int temp;
    for (int i = 0; i < count; ++i)
    {
        // 通过指针将数据复制到temp变量上
        // 注意指针类型是uint8，数值是int类型
        // ptr是指针起始位置，每读取1个int类型要偏移4，也就是i*4
        memcpy(&temp, ptr + i * 4, 4);
        // 计算指针中每个数的和
        total += temp;
    }
    return total;
}
EM_PORT_API(const char *)
get_string()
{
    const static char str[] = "This is a test.";
    return str;
}