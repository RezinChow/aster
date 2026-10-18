/* Host PTY for one SSH session.
 * stdin/stdout carry terminal bytes. File descriptor 3 accepts "resize COLS ROWS\n".
 */
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>
#include <util.h>

static int set_size(int fd, unsigned short cols, unsigned short rows) {
  struct winsize size;
  memset(&size, 0, sizeof(size));
  size.ws_col = cols;
  size.ws_row = rows;
  return ioctl(fd, TIOCSWINSZ, &size);
}

int main(int argc, char **argv) {
  if (argc < 4) {
    fprintf(stderr, "usage: fleet-ssh-pty COLS ROWS COMMAND...\n");
    return 64;
  }
  unsigned long cols_raw = strtoul(argv[1], NULL, 10);
  unsigned long rows_raw = strtoul(argv[2], NULL, 10);
  unsigned short cols = cols_raw < 2 ? 80 : (unsigned short)cols_raw;
  unsigned short rows = rows_raw < 2 ? 24 : (unsigned short)rows_raw;

  int master = -1;
  int slave = -1;
  if (openpty(&master, &slave, NULL, NULL, NULL) != 0) {
    perror("openpty");
    return 1;
  }
  set_size(master, cols, rows);

  pid_t child = fork();
  if (child < 0) {
    perror("fork");
    return 1;
  }
  if (child == 0) {
    close(master);
    setsid();
    ioctl(slave, TIOCSCTTY, 0);
    dup2(slave, STDIN_FILENO);
    dup2(slave, STDOUT_FILENO);
    dup2(slave, STDERR_FILENO);
    if (slave > STDERR_FILENO) close(slave);
    execvp(argv[3], argv + 3);
    perror("exec");
    _exit(127);
  }
  close(slave);

  int control = fcntl(3, F_GETFD) == -1 ? -1 : 3;
  char control_buf[256];
  size_t control_fill = 0;
  unsigned char io_buf[32768];

  for (;;) {
    struct pollfd fds[3];
    nfds_t count = 0;
    fds[count].fd = master;
    fds[count].events = POLLIN;
    count++;
    fds[count].fd = STDIN_FILENO;
    fds[count].events = POLLIN;
    count++;
    if (control >= 0) {
      fds[count].fd = control;
      fds[count].events = POLLIN;
      count++;
    }
    int ready = poll(fds, count, -1);
    if (ready < 0) {
      if (errno == EINTR) continue;
      break;
    }
    for (nfds_t index = 0; index < count; index++) {
      if ((fds[index].revents & (POLLIN | POLLHUP | POLLERR)) == 0) continue;
      if (fds[index].fd == master) {
        ssize_t got = read(master, io_buf, sizeof io_buf);
        if (got <= 0) goto done;
        ssize_t sent = 0;
        while (sent < got) {
          ssize_t wrote = write(STDOUT_FILENO, io_buf + sent, (size_t)(got - sent));
          if (wrote < 0) {
            if (errno == EINTR) continue;
            goto done;
          }
          sent += wrote;
        }
      } else if (fds[index].fd == STDIN_FILENO) {
        ssize_t got = read(STDIN_FILENO, io_buf, sizeof io_buf);
        if (got <= 0) goto done;
        ssize_t sent = 0;
        while (sent < got) {
          ssize_t wrote = write(master, io_buf + sent, (size_t)(got - sent));
          if (wrote < 0) {
            if (errno == EINTR) continue;
            goto done;
          }
          sent += wrote;
        }
      } else {
        if (control_fill >= sizeof control_buf - 1) control_fill = 0;
        ssize_t got = read(control, control_buf + control_fill, sizeof control_buf - 1 - control_fill);
        if (got <= 0) {
          control = -1;
          continue;
        }
        control_fill += (size_t)got;
        control_buf[control_fill] = 0;
        char *newline;
        while ((newline = strchr(control_buf, '\n')) != NULL) {
          *newline = 0;
          unsigned width = 0;
          unsigned height = 0;
          if (sscanf(control_buf, "resize %u %u", &width, &height) == 2 && width >= 2 && height >= 2) {
            set_size(master, (unsigned short)width, (unsigned short)height);
            kill(child, SIGWINCH);
          }
          size_t rest = control_fill - (size_t)(newline + 1 - control_buf);
          memmove(control_buf, newline + 1, rest);
          control_fill = rest;
          control_buf[control_fill] = 0;
        }
      }
    }
  }

done:
  ;
  int status = 0;
  pid_t reaped = waitpid(child, &status, WNOHANG);
  if (reaped == 0) {
    kill(child, SIGHUP);
    waitpid(child, &status, 0);
  }
  if (WIFEXITED(status)) return WEXITSTATUS(status);
  if (WIFSIGNALED(status)) return 128 + WTERMSIG(status);
  return 1;
}
