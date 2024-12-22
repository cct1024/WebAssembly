#include "macro.cc"
#include <stdio.h>
// emcc hello.cc -o hello.js -s FORCE_FILESYSTEM=1 -s NO_EXIT_RUNTIME=0
void read_fs(const char *file_name)
{
    FILE *fp = fopen("hello.txt", "rt");
    if (fp)
    {
        while (!feof(fp))
        {
            char c = fgetc(fp);
            if (c != EOF)
            {
                putchar(c);
            }
        }
        fclose(fp);
    }
    else
    {
        printf("err fp\n");
    }
}
void write_fs(const char *file_name)
{
    FILE *fp = fopen(file_name, "a+");
    if (fp)
    {
        fprintf(fp, "\nthis is hello.txt");
        fclose(fp);
    }
}
int main()
{
    read_fs("hello.txt");
    write_fs("hello.txt");
    read_fs("hello.txt");

    return 0;
}