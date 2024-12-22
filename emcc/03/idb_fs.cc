#include <emscripten.h>
#include <stdio.h>
#include "macro.cc"
// emcc idb_fs.cc -o idb_fs.js -lidbfs.js

void sync_idbfs()
{
    EM_ASM(
        FS.syncfs(function(err) {
            console.log('fs err: ', err);
        }););
}
EM_PORT_API(void)
read_file()
{
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

        sync_idbfs();
    }
    else
    {
        printf("fopen failed.\n");
    }
}
int main(){
    EM_ASM(
        FS.mkdir('/data');
        FS.mount(IDBFS,{},'/data');
        FS.syncfs(true,function(err){
            assert(!err);
            ccall('read_file','null');
        });
    );
    return 0;
}