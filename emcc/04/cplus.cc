#include "macro.cc"
// emcc cplus.cc -o cplus.js
class Hello
{
public:
    int sum(int a, int b)
    {
        return a + b;
    }
    int getID()
    {
        return id;
    }

private:
    int id;
};
struct Demo;
// 返回值类型为C接口的struc对象
EM_PORT_API(struct Demo *)
Demo_New()
{
    // 实例化c++对象
    Hello *hello = new Hello();
    // 将c++指针类型对象转换成C类型指针对象
    return (struct Demo *)hello;
}
EM_PORT_API(void)
Demo_Delete(struct Demo *demo)
{
    // 声明c++类型指针，将c类型指针强制转换
    Hello *hello = (Hello *)demo;
    // 释放c++类型指针对象
    delete hello;
}
EM_PORT_API(int)
Demo_Sum(struct Demo *d, int a, int b)
{
    Hello *hello = (Hello *)d;
    return hello->sum(a, b);
}
EM_PORT_API(int)
Demo_GetID(struct Demo *d)
{
    Hello *hello = (Hello *)d;
    return hello->getID();
}