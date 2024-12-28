#include "macro.cc"
#include <atomic>
#include <stdio.h>
// emcc ref.cc -o ref.js
#ifndef SAFE_RELEASE
#define SAFE_RELEASE(p)     \
    {                       \
        if (p)              \
        {                   \
            (p)->Release(); \
            (p) = NULL;     \
        }                   \
    }
#endif
class Demo
{
public:
    Demo() : m_ref_count(1) {}
    virtual ~Demo() {}
    void AddRef()
    {
        m_ref_count++;
    }
    int Release()
    {
        int t = --m_ref_count;
        if (t == 0)
        {
            delete this;
        }
        return t;
    }
    virtual void say()
    {
        printf("parent Demo\n");
    }

protected:
    std::atomic<int> m_ref_count;
};
struct Shape;
EM_PORT_API(void)
addRef(struct Shape *shape)
{
    Demo *obj = (Demo *)shape;
    obj->AddRef();
}
EM_PORT_API(int)
release(struct Shape *shape)
{
    Demo *obj = (Demo *)shape;
    return obj->Release();
}
class Rect : public Demo
{
public:
    void say()
    {
        printf("Rect\n");
    }
};
EM_PORT_API(struct Shape *)
NewDemo()
{
    Demo *demo = new Demo();
    return (struct Shape *)demo;
}
EM_PORT_API(struct Shape *)
NewRect()
{
    Rect *demo = new Rect();
    return (struct Shape *)demo;
}
EM_PORT_API(void)
say(struct Shape *s)
{
    Demo *d = (Demo *)s;
    d->say();
}