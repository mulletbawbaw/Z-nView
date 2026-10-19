#ifdef __linux__

#include <string.h>
#include <sys/mman.h>
#include <unistd.h>

#include "../include/secure_memory_types.h"

namespace nview {

namespace {

// mlock/madvise operate on whole pages; expand [data, data + length) to page bounds.
void PageRange(uint8_t* data, size_t length, void** start, size_t* span) {
  const uintptr_t pageSize = static_cast<uintptr_t>(sysconf(_SC_PAGESIZE));
  const uintptr_t begin = reinterpret_cast<uintptr_t>(data) & ~(pageSize - 1);
  const uintptr_t end = (reinterpret_cast<uintptr_t>(data) + length + pageSize - 1) & ~(pageSize - 1);
  *start = reinterpret_cast<void*>(begin);
  *span = static_cast<size_t>(end - begin);
}

}  // namespace

LockResult LockBuffer(uint8_t* data, size_t length) {
  if (data == nullptr || length == 0) {
    return {true, false};
  }

  void* start = nullptr;
  size_t span = 0;
  PageRange(data, length, &start, &span);

  // Keep key material out of swap; failure (e.g. RLIMIT_MEMLOCK) falls back to wipe-only.
  const bool locked = mlock(start, span) == 0;
  if (locked) {
    // Best effort: keep locked pages out of core dumps as well.
    madvise(start, span, MADV_DONTDUMP);
  }
  return {true, locked};
}

OpResult UnlockBuffer(uint8_t* data, size_t length) {
  if (data == nullptr || length == 0) {
    return {true};
  }

  void* start = nullptr;
  size_t span = 0;
  PageRange(data, length, &start, &span);
  return {munlock(start, span) == 0};
}

OpResult WipeBuffer(uint8_t* data, size_t length) {
  if (data == nullptr || length == 0) {
    return {true};
  }

  explicit_bzero(data, length);
  return {true};
}

}  // namespace nview

#endif
