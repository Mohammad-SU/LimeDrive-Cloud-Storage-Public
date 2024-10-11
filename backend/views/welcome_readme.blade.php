<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to LimeDrive.</title>
        <style>
            html, body {
                height: 100%;
                margin: 0;
                padding: 0;
            }
            
            body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: "Consolas", monospace;
                background-color: black;
                color: lime;
                box-sizing: border-box
            }
                .heading {
                    text-align: center;
                    font-size: 0.55rem;
                    margin: 0;
                    margin-top: -1rem;

                    @media (max-width: 400px) {
                        font-size: 0.5rem;
                    }
                    @media (max-width: 360px) {
                        font-size: 0.45rem;
                    }
                }

                main {
                    padding: 1rem;
                    max-width: 42.686rem; /* To match the first p */
                    width: 100%;
                    box-sizing: border-box;

                    p {
                        margin: 1.3rem 0;

                        &:first-of-type {
                            margin-top: 2.5rem;

                            @media (max-width: 460px) {
                                margin-top: 1.5rem;
                            }
                        }
                        &:last-of-type {
                            margin-bottom: 0;
                        }
                    }
                }

                a {
                    color: inherit;
                    text-underline-offset: 0.3rem;
                    text-decoration: underline;
                    text-decoration-color: rgba(0, 255, 0, 0.55);

                    &:hover {
                        text-decoration-color: lime;
                    }
                    &:active {
                        text-decoration-color: rgba(0, 255, 0, 0.55);
                    }
                }

                ::selection {
                    background-color: rgba(0, 255, 0, 0.4);
                    color: lime;
                }
                :focus {
                    outline: none;
                }
                :focus-visible {
                    outline: .125rem dashed lime !important;
                    outline-offset: .1875rem;
                }

        </style>
    </head>
    <body>
        <pre class="heading">
$$\      $$\           $$\                                              $$\
 $$ | $\  $$ |          $$ |                                             $$ |
 $$ |$$$\ $$ | $$$$$$\  $$ | $$$$$$$\  $$$$$$\  $$$$$$\$$$$\   $$$$$$\   $$ |
 $$ $$ $$\$$ |$$  __$$\ $$ |$$  _____|$$  __$$\ $$  _$$  _$$\ $$  __$$\  $$ |
 $$$$  _$$$$ |$$$$$$$$ |$$ |$$ /      $$ /  $$ |$$ / $$ / $$ |$$$$$$$$ | $$ |
 $$$  / \$$$ |$$   ____|$$ |$$ |      $$ |  $$ |$$ | $$ | $$ |$$   ____| \__|
$$  /   \$$ |\$$$$$$$\ $$ |\$$$$$$$\ \$$$$$$  |$$ | $$ | $$ |\$$$$$$$\  $$\
 \__/     \__| \_______|\__| \_______| \______/ \__| \__| \__| \_______| \__|</pre>
        <main>
            <p>
                LimeDrive is a cloud storage/file hosting service created by Mohammad S.U.
            </p>
            <p>
                It contains many features that a web-based file management system would contain, 
                including keyboard shortcuts to select multiple items at once, 
                double-clicking to open, and drag-and-drop to sort them into folders.
            </p>
            <p>
                The file viewer allows you to open supported files in the browser itself.
            </p>
            <p>
                Check out the sample files in the "Samples" folder. You can restore 
                it from your settings too.
            </p>
            <p>
                Want more technical details? <a href="https://github.com/Mohammad-SU/LimeDrive-Cloud-Storage-Public" target="_blank">Click here to visit the repo.</a>
            </p>
            <p>
                Thank you for using LimeDrive. Enjoy your stay!
            </p>
        </main>
    </body>
</html>