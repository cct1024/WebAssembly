#include <emscripten.h>
#include <stdio.h>
// emcc node_fs.cc -o node_fs.js -lnodefs.js
/**
 * 1. 通过EM_ASM运行js脚本，通过FS.mkdir创建了虚拟文件目录
 * 2. 通过FS.mount将当前目录挂载/data目录
 * 3. 注意-lnodefs.js参数在emscripten2.x版本之后需要手动指定才会为nodejs打包文件系统模块
 * 4. 使用fs生成的胶水代码又臭又长，不推荐使用！
 */
void setup_nodefs()
{
    EM_ASM(
        FS.mkdir('/data');
        FS.mount(NODEFS, {root : '.'}, '/data'););
}
int main()
{
    setup_nodefs();
    FILE *fp = fopen("/data/nodefs_data.txt", "r+t");
    if (fp == NULL)
        fp = fopen("/data/nodefs_data.txt", "w+t");
    int count = 0;
    if (fp)
    {
        fscanf(fp, "%d", &count);
        count++;
        fseek(fp, 0, SEEK_SET);
        fprintf(fp, "%d", count);
        fclose(fp);
        printf("count:%d\n", count);
    }
    else
    {
        printf("fopen failed.\n");
    }

    return 0;
}