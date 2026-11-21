// Offscreen macOS OpenGL execution of the renderer's GLSL. No window,
// browser automation, display readback, or screen recording is used.
#import <Foundation/Foundation.h>
#include <OpenGL/OpenGL.h>
#include <OpenGL/gl3.h>
#include <math.h>

static GLuint shader(GLenum type, NSString *source) {
  GLuint s = glCreateShader(type);
  const char *text = source.UTF8String;
  glShaderSource(s, 1, &text, NULL);
  glCompileShader(s);
  GLint ok = 0;
  glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    char log[32768];
    glGetShaderInfoLog(s, sizeof(log), NULL, log);
    @throw [NSException exceptionWithName:@"ShaderCompile"
                                   reason:[NSString stringWithUTF8String:log]
                                 userInfo:nil];
  }
  return s;
}
static NSDictionary *uniformInfo(GLuint p) {
  NSMutableDictionary *info = [NSMutableDictionary dictionary];
  GLint n = 0;
  glGetProgramiv(p, GL_ACTIVE_UNIFORMS, &n);
  for (int i = 0; i < n; i++) {
    char name[256];
    GLint size;
    GLenum type;
    glGetActiveUniform(p, i, sizeof(name), NULL, &size, &type, name);
    info[[NSString stringWithUTF8String:name]] = @{@"type" : @(type), @"size" : @(size)};
  }
  return info;
}
static void uniforms(GLuint p, NSDictionary *info, NSDictionary *values) {
  for (NSString *name in values) {
    GLint loc = glGetUniformLocation(p, name.UTF8String);
    if (loc < 0)
      continue;
    NSDictionary *meta = info[name] ?: info[[name stringByAppendingString:@"[0]"]];
    if (!meta)
      @throw [NSException exceptionWithName:@"Uniform" reason:name userInfo:nil];
    GLenum type = [meta[@"type"] unsignedIntValue];
    id v = values[name];
    NSArray *a = [v isKindOfClass:[NSArray class]] ? v : @[ v ];
    NSUInteger n = a.count;
    GLfloat *f = calloc(n, sizeof(GLfloat));
    GLint *j = calloc(n, sizeof(GLint));
    for (NSUInteger i = 0; i < n; i++) {
      f[i] = [a[i] floatValue];
      j[i] = [a[i] intValue];
    }
    switch (type) {
    case GL_FLOAT:
      glUniform1fv(loc, (GLsizei)n, f);
      break;
    case GL_FLOAT_VEC2:
      glUniform2fv(loc, (GLsizei)n / 2, f);
      break;
    case GL_FLOAT_VEC3:
      glUniform3fv(loc, (GLsizei)n / 3, f);
      break;
    case GL_FLOAT_VEC4:
      glUniform4fv(loc, (GLsizei)n / 4, f);
      break;
    case GL_INT:
    case GL_BOOL:
    case GL_SAMPLER_2D:
      glUniform1iv(loc, (GLsizei)n, j);
      break;
    case GL_INT_VEC2:
      glUniform2iv(loc, (GLsizei)n / 2, j);
      break;
    case GL_INT_VEC3:
      glUniform3iv(loc, (GLsizei)n / 3, j);
      break;
    case GL_INT_VEC4:
      glUniform4iv(loc, (GLsizei)n / 4, j);
      break;
    case GL_FLOAT_MAT4:
      glUniformMatrix4fv(loc, (GLsizei)n / 16, GL_FALSE, f);
      break;
    default:
      free(f);
      free(j);
      @throw [NSException exceptionWithName:@"UniformType" reason:name userInfo:nil];
    }
    free(f);
    free(j);
  }
}
static void emit(NSDictionary *value) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
  fwrite(data.bytes, 1, data.length, stdout);
  fputc('\n', stdout);
  fflush(stdout);
}
int main() {
  @autoreleasepool {
    CGLPixelFormatAttribute attrs[] = {kCGLPFAOpenGLProfile,
                                       (CGLPixelFormatAttribute)kCGLOGLPVersion_3_2_Core,
                                       kCGLPFAAccelerated, (CGLPixelFormatAttribute)0};
    CGLPixelFormatObj format;
    GLint n;
    CGLContextObj context;
    CGLError err = CGLChoosePixelFormat(attrs, &format, &n);
    if (err || !format) {
      emit(@{@"error" : [NSString stringWithFormat:@"CGLChoosePixelFormat: %d", err]});
      return 1;
    }
    err = CGLCreateContext(format, 0, &context);
    if (err) {
      emit(@{@"error" : @"Cannot create offscreen OpenGL context"});
      return 1;
    }
    CGLSetCurrentContext(context);
    emit(@{
      @"ready" : @YES,
      @"version" : [NSString stringWithUTF8String:(const char *)glGetString(GL_VERSION)],
      @"renderer" : [NSString stringWithUTF8String:(const char *)glGetString(GL_RENDERER)],
      @"vendor" : [NSString stringWithUTF8String:(const char *)glGetString(GL_VENDOR)]
    });
    GLuint vao, fb, targets[4], env;
    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);
    glGenFramebuffers(1, &fb);
    glBindFramebuffer(GL_FRAMEBUFFER, fb);
    glGenTextures(4, targets);
    GLenum buffers[4];
    for (int i = 0; i < 4; i++) {
      glBindTexture(GL_TEXTURE_2D, targets[i]);
      glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 1, 1, 0, GL_RGBA, GL_FLOAT, NULL);
      glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
      glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
      buffers[i] = GL_COLOR_ATTACHMENT0 + i;
      glFramebufferTexture2D(GL_FRAMEBUFFER, buffers[i], GL_TEXTURE_2D, targets[i], 0);
    }
    glDrawBuffers(4, buffers);
    glViewport(0, 0, 1, 1);
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
      emit(@{@"error" : @"Incomplete float framebuffer"});
      return 1;
    }
    glGenTextures(1, &env);
    glBindTexture(GL_TEXTURE_2D, env);
    GLubyte pixel[] = {128, 128, 128, 255};
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, 1, 1, 0, GL_RGBA, GL_UNSIGNED_BYTE, pixel);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    NSMutableDictionary *programs = [NSMutableDictionary dictionary],
                        *metadata = [NSMutableDictionary dictionary];
    char *line = NULL;
    size_t cap = 0;
    while (getline(&line, &cap, stdin) > 0) {
      @autoreleasepool {
        @try {
          NSData *data =
              [[NSString stringWithUTF8String:line] dataUsingEncoding:NSUTF8StringEncoding];
          NSDictionary *request = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
          NSString *op = request[@"op"], *name = request[@"name"];
          if ([op isEqualToString:@"compile"]) {
            GLuint p = glCreateProgram(), v = shader(GL_VERTEX_SHADER, request[@"vertex"]),
                   f = shader(GL_FRAGMENT_SHADER, request[@"fragment"]);
            glAttachShader(p, v);
            glAttachShader(p, f);
            glLinkProgram(p);
            GLint ok;
            glGetProgramiv(p, GL_LINK_STATUS, &ok);
            if (!ok) {
              char log[32768];
              glGetProgramInfoLog(p, sizeof(log), NULL, log);
              @throw [NSException exceptionWithName:@"Link"
                                             reason:[NSString stringWithUTF8String:log]
                                           userInfo:nil];
            }
            programs[name] = @(p);
            metadata[name] = uniformInfo(p);
            glDeleteShader(v);
            glDeleteShader(f);
            emit(@{@"compiled" : name});
          } else if ([op isEqualToString:@"draw"]) {
            GLuint p = [programs[name] unsignedIntValue];
            if (!p)
              @throw [NSException exceptionWithName:@"Program" reason:name userInfo:nil];
            glUseProgram(p);
            uniforms(p, metadata[name], request[@"uniforms"]);
            glDrawArrays(GL_TRIANGLES, 0, 3);
            NSMutableArray *values = [NSMutableArray array];
            BOOL finite = YES;
            for (int i = 0; i < 4; i++) {
              GLfloat out[4];
              glReadBuffer(GL_COLOR_ATTACHMENT0 + i);
              glReadPixels(0, 0, 1, 1, GL_RGBA, GL_FLOAT, out);
              for (int j = 0; j < 4; j++) {
                if (isfinite(out[j]))
                  [values addObject:@(out[j])];
                else {
                  [values addObject:[NSNull null]];
                  finite = NO;
                }
              }
            }
            emit(@{@"pixels" : values, @"finite" : @(finite), @"glError" : @(glGetError())});
          } else if ([op isEqualToString:@"render"]) {
            int width = [request[@"width"] intValue], height = [request[@"height"] intValue],
                frames = [request[@"frames"] intValue];
            if (width < 1 || height < 1 || width > 4096 || height > 4096 || frames < 1 ||
                frames > 1000)
              @throw [NSException exceptionWithName:@"Size"
                                             reason:@"Invalid render dimensions or frame count"
                                           userInfo:nil];
            for (int i = 0; i < 4; i++) {
              glBindTexture(GL_TEXTURE_2D, targets[i]);
              glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, width, height, 0, GL_RGBA, GL_FLOAT, NULL);
            }
            glBindTexture(GL_TEXTURE_2D, env);
            glViewport(0, 0, width, height);
            GLuint p = [programs[name] unsignedIntValue];
            glUseProgram(p);
            uniforms(p, metadata[name], request[@"uniforms"]);
            for (int i = 0; i < 5; i++) {
              glDrawArrays(GL_TRIANGLES, 0, 3);
              glFinish();
            }
            NSMutableArray *times = [NSMutableArray array];
            for (int i = 0; i < frames; i++) {
              CFAbsoluteTime start = CFAbsoluteTimeGetCurrent();
              glDrawArrays(GL_TRIANGLES, 0, 3);
              glFinish();
              [times addObject:@((CFAbsoluteTimeGetCurrent() - start) * 1000.)];
            }
            NSString *path = request[@"path"];
            if (path) {
              size_t count = (size_t)width * height * 4;
              GLubyte *pixels = malloc(count);
              glReadBuffer(GL_COLOR_ATTACHMENT0);
              glReadPixels(0, 0, width, height, GL_RGBA, GL_UNSIGNED_BYTE, pixels);
              FILE *file = fopen(path.fileSystemRepresentation, "wb");
              if (!file)
                @throw [NSException exceptionWithName:@"File" reason:path userInfo:nil];
              fprintf(file, "P6\n%d %d\n255\n", width, height);
              for (int y = height - 1; y >= 0; y--)
                for (int x = 0; x < width; x++)
                  fwrite(pixels + 4 * ((size_t)y * width + x), 1, 3, file);
              fclose(file);
              free(pixels);
            }
            emit(@{
              @"width" : @(width),
              @"height" : @(height),
              @"milliseconds" : times,
              @"glError" : @(glGetError())
            });
            for (int i = 0; i < 4; i++) {
              glBindTexture(GL_TEXTURE_2D, targets[i]);
              glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, 1, 1, 0, GL_RGBA, GL_FLOAT, NULL);
            }
            glBindTexture(GL_TEXTURE_2D, env);
            glViewport(0, 0, 1, 1);
          } else if ([op isEqualToString:@"quit"]) {
            emit(@{@"bye" : @YES});
            break;
          } else
            @throw [NSException exceptionWithName:@"Request"
                                           reason:@"Unknown operation"
                                         userInfo:nil];
        } @catch (NSException *ex) {
          emit(@{@"error" : ex.reason ?: ex.name});
        }
      }
    }
    free(line);
    CGLSetCurrentContext(NULL);
    CGLDestroyContext(context);
    CGLDestroyPixelFormat(format);
  }
  return 0;
}
