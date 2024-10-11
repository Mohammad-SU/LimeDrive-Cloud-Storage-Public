<!DOCTYPE html>
<html lang="en">
    @include('email_head')
    <body>
        <p class="first-p">
            Please verify your email by clicking <a href={{ $verifyEmailUrl }}>here</a>.
        </p>
        <p>
            @if($isNewRegister)
                Thank you for registering with <a href='https://limedrive.net'>LimeDrive.net</a>. Enjoy sleek, seamless cloud storage and file hosting.
            @else
                After verifying, any email notifications will be sent to this address unless it is changed.
            @endif
        </p>
        <p class="last-p">
            If you didn't 
            @if($isNewRegister)
                register
            @else
                register this email
            @endif
             then you can safely ignore this.
        </p>
    </body>
</html>