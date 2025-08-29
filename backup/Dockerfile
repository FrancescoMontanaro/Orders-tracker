# Immagine minimale con client MySQL/MariaDB e cron
FROM alpine:3.20

# Install the required dependencies
RUN apk add --no-cache mysql-client tzdata ca-certificates restic

# Set the appropriate timezone
ENV TZ=Europe/Rome

# Copy the required scripts and crontabs
COPY backup.sh /usr/local/bin/backup.sh
COPY crontab /etc/crontabs/root

# Set the execution permissions
RUN chmod +x /usr/local/bin/backup.sh

# Log di cron (cron su Alpine scrive su stdout se -f; la redirezione è nella crontab)
CMD ["crond", "-f", "-l", "2"]