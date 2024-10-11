<!DOCTYPE html>
<html lang="en">
    @include('email_head')
    <body>
        <p class="first-p">
            Your {{ $detailType }} for your <a href='https://limedrive.net'>LimeDrive.net</a> account was changed successfully.
        </p>
        <p class="last-p">
            If this wasn't you, please <a href='https://limedrive.net'>click here.</a>
        </p>
    </body>
</html>