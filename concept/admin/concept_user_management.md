# Usermanagement

Users can be managed on a certain management board ui.

There users are listed on a scrollable pane, the page itself does not scroll.

On the left is displayed user icon, the letter A if they are admin and afterwards user name. Each user has multiple actions listed to the right with some space to the name for longer names.

When a new user wants to register, they have to provide email and a registration token as well as a new password. The password has to contain a lower, uppercase letter, a special character and a number and has to be at least 12 characters long. 

Those are edit; which opens an extra panel layered above the current menu, blurring the area around it.
In there are listed:
- user icon - read only, behind it a button called clear and ask user to change at next
login, is then displayed with default icon.
- username - read only, behind it a button called clear and ask user to rename at next
login. The user name is then replaced by a fill name so other users don't see the original name. This feature
is required when users choose an inapropriate name.
- email - read only.
- registered at - read only, date one registered.
- last login at - read only, date of last login.
- invited by - user name of user who created invite token.
- user roles - read and write, is an input field containing user roles as tags.
    A tag has a little x to the right to remove it from the user, there also always has to be one admin user.
    Tags are stored in a catalogue, when a tag is entered into the input field, autocomplete will suggest existing tags when typing.
The single user management panel got an x on the top right but also closes when clicking on the blurred area.
- invited users - read only, contains a list of users which used a registration token created by this user.