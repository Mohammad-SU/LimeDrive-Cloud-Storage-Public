FROM php:8.2.9
WORKDIR /app

COPY .user.ini /usr/local/etc/php/conf.d/

RUN apt-get update && apt-get install -y \
    git \
    unzip \
    supervisor \
    libzip-dev \
    libpq-dev       # libpq-dev for pgsql to work

RUN docker-php-ext-install pdo pgsql pdo_pgsql zip
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY . .

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN composer install --optimize-autoloader --prefer-dist --no-dev

RUN php artisan config:cache
RUN php artisan event:cache
RUN php artisan route:cache
RUN php artisan view:cache
RUN php artisan app:reload-proxies # run initially to prevent issues, although a scheduled command will be ran after
RUN php artisan migrate --force

EXPOSE 8000

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]