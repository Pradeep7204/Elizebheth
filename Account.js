'use strict';

/**
 * Controller that renders the account overview, manages customer registration and password reset,
 * and edits customer profile information.
 *
 * @module controllers/Account
 */

/* API includes */
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var Form = require('~/cartridge/scripts/models/FormModel');
var Transaction = require('dw/system/Transaction');


/* Script Modules */
var app = require('~/cartridge/scripts/app');
var guard = require('~/cartridge/scripts/guard');

/**
 * Gets a ContentModel object that wraps the myaccount-home content asset,
 * updates the page metadata, and renders the account/accountoverview template.
 */
function show() {
    var accountHomeAsset, pageMeta, Content;

    Content = app.getModel('Content');
    accountHomeAsset = Content.get('myaccount-home');

    pageMeta = require('~/cartridge/scripts/meta');
    pageMeta.update(accountHomeAsset);

    app.getView().render('account/accountoverview');
}

/**
 * Clears the profile form and copies customer profile information from the customer global variable
 * to the form. Gets a ContentModel object that wraps the myaccount-personaldata content asset, and updates the page
 * meta data. Renders the account/user/registration template using an anonymous view.
 */
function editProfile() {
    var pageMeta;
    var accountPersonalDataAsset;
    var Content = app.getModel('Content');
    session.custom.PreviousEmail = customer.profile.email;
    if (!request.httpParameterMap.invalid.submitted) {
        app.getForm('profile').clear();

        app.getForm('profile.customer').copyFrom(customer.profile);
        app.getForm('profile.login').copyFrom(customer.profile.credentials);
        app.getForm('profile.addressbook.addresses').copyFrom(customer.profile.addressBook.addresses);
    }
    accountPersonalDataAsset = Content.get('myaccount-personaldata');
    //EASM-50
    var birthDate  = !empty(customer.profile.getBirthday()) ? customer.profile.getBirthday().getDate():'';
    var profileForm = app.getForm('profile.customer');
    if('date' in profileForm.object ){
    	profileForm.object.date.htmlValue = birthDate;
    }
    pageMeta = require('~/cartridge/scripts/meta');
    pageMeta.update(accountPersonalDataAsset);
    // @FIXME bctext2 should generate out of pagemeta - also action?!
    app.getView({
        bctext2: Resource.msg('account.user.registration.editaccount', 'account', null),
        Action: 'edit',
        ContinueURL: URLUtils.https('Account-EditForm')
    }).render('account/user/registration');
}

/**
 * Handles the form submission on profile update of edit profile. Handles cancel and confirm actions.
 *  - cancel - clears the profile form and redirects to the Account-Show controller function.
 *  - confirm - gets a CustomerModel object that wraps the current customer. Validates several form fields.
 * If any of the profile validation conditions fail, the user is redirected to the Account-EditProfile controller function. If the profile is valid, the user is redirected to the Account-Show controller function.
 */
function editForm() {
	var hasEditSucceeded;
    app.getForm('profile').handleAction({
        cancel: function () {
            app.getForm('profile').clear();
            response.redirect(URLUtils.https('Account-Show'));
        },
        confirm: function () {
        	session.custom.isEditFormAddtoEmailList = app.getForm('profile.customer.addtoemaillist').value();
            var isProfileUpdateValid = true;
            hasEditSucceeded = false;
            var Customer = app.getModel('Customer');

            if (!Customer.checkUserName()) {
                app.getForm('profile.customer.email').invalidate();
                isProfileUpdateValid = false;
            }

            if (app.getForm('profile.customer.email').value() !== app.getForm('profile.customer.emailconfirm').value()) {
                app.getForm('profile.customer.emailconfirm').invalidate();
                isProfileUpdateValid = false;
            }

            if (app.getForm('profile.login.password').value() !== app.getForm('profile.login.passwordconfirm').value()) {
                app.getForm('profile.login.passwordconfirm').invalidate();
                isProfileUpdateValid = false;
            }

            if (isProfileUpdateValid) {
            	var month, year,date;
                month = app.getForm('profile.customer.month').value();
                year = app.getForm('profile.customer.year').value();
                if(dw.system.Site.getCurrent().ID != 'ElizabethArden')
                date = !empty (app.getForm('profile.customer.date'))? app.getForm('profile.customer.date').value():'';
                app.getForm('emailsubscribe.birthdate.month').object.value = month;
                app.getForm('emailsubscribe.birthdate.year').object.value = year;
                
                //EASM-50
                if(!empty(date)){
                	date = parseInt(date)!= 0 ? date : parseInt('01');
                	app.getForm('emailsubscribe.birthdate.day').object.value = date;
                }
                
                if(empty(year))
            		year = '1980';
            	
                if(!empty(date))
                	{
                		var birthdate : Date = new Date(month + "/01/" + year);
                		birthdate.setDate(parseInt(date));
                		app.getForm('profile.customer.birthday').object.value = birthdate ;
                	}
                else
                	{
                		app.getForm('profile.customer.birthday').object.value = new Date(month + "/01/" + year) ;
                	}
                hasEditSucceeded = Customer.editAccount(app.getForm('profile.customer.email').value(), app.getForm('profile.login.password').value(), app.getForm('profile'));
            }

            /*****************************PREVAIL - Email Sign-up Integration****************************************/
            if (app.getForm('profile.customer.addtoemaillist').value() || request.httpParameterMap.dwfrm_profile_customer_addtoemaillist.value == 'true') {
                emailSignUp();
            }

            if (isProfileUpdateValid && hasEditSucceeded) {
                response.redirect(URLUtils.https('Account-Show'));
            } else {
                response.redirect(URLUtils.https('Account-EditProfile', 'invalid', 'true'));
            }
        }
    });
    Transaction.wrap(function () {
    	if(hasEditSucceeded){
        	var previousEmail = session.custom.PreviousEmail;
        	var currentEmail = session.custom.CurrentEmail;
        	var lastEmailChangeOrderDate;
        	var cstmr =customer;
        	if(!(previousEmail.equalsIgnoreCase(currentEmail))){
            	lastEmailChangeOrderDate = dw.object.CustomObjectMgr.getCustomObject("customerPreviousEmailUpdateDate", customer.profile.customerNo);
            	if(lastEmailChangeOrderDate == null){
            		lastEmailChangeOrderDate = dw.object.CustomObjectMgr.createCustomObject("customerPreviousEmailUpdateDate", customer.profile.customerNo);
            		lastEmailChangeOrderDate.custom.emailUpdateDate = new Date;
            		lastEmailChangeOrderDate.custom.customerPreviousEmail = currentEmail;
            	}
            	else{
            		lastEmailChangeOrderDate.custom.emailUpdateDate = new Date;
            		lastEmailChangeOrderDate.custom.customerPreviousEmail = currentEmail;
            	}
        	}
        }
    });
}

/**
 * Gets the requestpassword form and renders the requestpasswordreset template. This is similar to the password reset
 * dialog, but has a screen-based interaction instead of a popup interaction.
 */
function passwordReset() {
    app.getForm('requestpassword').clear();
    app.getView({
        ContinueURL: URLUtils.https('Account-PasswordResetForm')
    }).render('account/password/requestpasswordreset');
}

/**
 * Handles form submission from dialog and full page password reset. Handles cancel, send, and error actions.
 *  - cancel - renders the given template.
 *  - send - gets a CustomerModel object that wraps the current customer. Gets an EmailModel object that wraps an Email object.
 * Checks whether the customer requested the their login password be reset.
 * If the customer wants to reset, a password reset token is generated and an email is sent to the customer using the mail/resetpasswordemail template.
 * Then the account/password/requestpasswordreset_confirm template is rendered.
 *  - error - the given template is rendered and passed an error code.
 */
function passwordResetFormHandler(templateName, continueURL) {
    var resetPasswordToken, passwordemail;

    app.getForm('profile').handleAction({
        cancel: function () {
            app.getView({
                ContinueURL: continueURL
            }).render(templateName);
        },
        send: function () {
            var Customer, resettingCustomer, Email;
            Customer = app.getModel('Customer');
            Email = app.getModel('Email');
            var requestForm = Form.get('requestpassword').object.email.htmlValue;
            resettingCustomer = Customer.retrieveCustomerByLogin(requestForm);

            if (!empty(resettingCustomer)) {
                resetPasswordToken = resettingCustomer.generatePasswordResetToken();

                passwordemail = Email.get('mail/resetpasswordemail', resettingCustomer.object.profile.email);
                passwordemail.setSubject(Resource.msg('resource.passwordassistance', 'email', null));
                passwordemail.send({
                    ResetPasswordToken: resetPasswordToken,
                    Customer: resettingCustomer.object.profile.customer
                });
            }

            //for security reasons the same message will be shown for a valid reset password request as for a invalid one
            app.getView({
                ErrorCode: null,
                ShowContinue: true,
                ContinueURL: continueURL
            }).render('account/password/requestpasswordreset_confirm');
        },
        error: function () {
            app.getView({
                ErrorCode: 'formnotvalid',
                ContinueURL: continueURL
            }).render(templateName);
        }
    });
}

/**
 * The form handler for password resets.
 */
function passwordResetForm() {
    passwordResetFormHandler('account/password/requestpasswordreset', URLUtils.https('Account-PasswordResetForm'));
}

/**
 * Clears the requestpassword form and renders the account/password/requestpasswordresetdialog template.
 */
function passwordResetDialog() {
	
	var pageMeta, passResetAsset, Content;
    Content = app.getModel('Content');
    
    passResetAsset = Content.get('myaccount-passresetdialogue');

    pageMeta = require('~/cartridge/scripts/meta');
    if (passResetAsset != null){
    pageMeta.update(passResetAsset);
    }
	
    // @FIXME reimplement using dialogify
    app.getForm('requestpassword').clear();
    app.getView({
        ContinueURL: URLUtils.https('Account-PasswordResetDialogForm')
    }).render('account/password/requestpasswordresetdialog');
}

/**
 * Handles the password reset form.
 */
function passwordResetDialogForm() {
    // @FIXME reimplement using dialogify
    passwordResetFormHandler('account/password/requestpasswordresetdialog', URLUtils.https('Account-PasswordResetDialogForm'));
}

/**
 * Gets a CustomerModel wrapping the current customer. Clears the resetpassword form. Checks if the customer wants to reset their password.
 * If there is no reset token, redirects to the Account-PasswordReset controller function. If there is a reset token,
 * renders the screen for setting a new password.
 */
function setNewPassword() {
    var Customer, resettingCustomer;
    Customer = app.getModel('Customer');

    app.getForm('resetpassword').clear();
    resettingCustomer = Customer.getByPasswordResetToken(request.httpParameterMap.Token.getStringValue());

    if (empty(resettingCustomer)) {
        response.redirect(URLUtils.https('Account-PasswordReset'));
    } else {
        app.getView({
            ContinueURL: URLUtils.https('Account-SetNewPasswordForm')
        }).render('account/password/setnewpassword');
    }
}

/**
 * Gets a profile form and handles the cancel and send actions.
 *  - cancel - renders the setnewpassword template.
 *  - send - gets a CustomerModel object that wraps the current customer and gets an EmailModel object that wraps an Email object.
 * Checks whether the customer can be retrieved using a reset password token.
 * If the customer does not have a valid token, the controller redirects to the Account-PasswordReset controller function.
 * If they do, then an email is sent to the customer using the mail/setpasswordemail template and the setnewpassword_confirm template is rendered.
 * */
function setNewPasswordForm() {

    app.getForm('profile').handleAction({
        cancel: function () {
            app.getView({
                ContinueURL: URLUtils.https('Account-SetNewPasswordForm')
            }).render('account/password/setnewpassword');
            return;
        },
        send: function () {
            var Customer;
            var Email;
            var passwordChangedMail;
            var resettingCustomer;
            var success;

            Customer = app.getModel('Customer');
            Email = app.getModel('Email');
            resettingCustomer = Customer.getByPasswordResetToken(request.httpParameterMap.Token.getStringValue());

            if (!resettingCustomer) {
                response.redirect(URLUtils.https('Account-PasswordReset'));
            }

            if (app.getForm('resetpassword.password').value() !== app.getForm('resetpassword.passwordconfirm').value()) {
                app.getForm('resetpassword.passwordconfirm').invalidate();
                app.getView({
                    ContinueURL: URLUtils.https('Account-SetNewPasswordForm')
                }).render('account/password/setnewpassword');
            } else {

                success = resettingCustomer.resetPasswordByToken(request.httpParameterMap.Token.getStringValue(), app.getForm('resetpassword.password').value());
                if (!success) {
                    app.getView({
                        ErrorCode: 'formnotvalid',
                        ContinueURL: URLUtils.https('Account-SetNewPasswordForm')
                    }).render('account/password/setnewpassword');
                } else {
                    passwordChangedMail = Email.get('mail/passwordchangedemail', resettingCustomer.object.profile.email);
                    passwordChangedMail.setSubject(Resource.msg('resource.passwordassistance', 'email', null));
                    passwordChangedMail.send({
                        Customer: resettingCustomer.object
                    });

                    app.getView().render('account/password/setnewpassword_confirm');
                }
            }
        }
    });
}

/** Clears the profile form, adds the email address from login as the profile email address,
 *  and renders customer registration page.
 */
function startRegister() {

    app.getForm('profile').clear();
    
    var Content, accountRegisterAsset, pageMeta;
	
    Content = app.getModel('Content');
    accountRegisterAsset = Content.get('myaccount-register');

    pageMeta = require('~/cartridge/scripts/meta');
    if (accountRegisterAsset != null){
    pageMeta.update(accountRegisterAsset);
    }

    if (app.getForm('login.username').value() !== null) {
        app.getForm('profile.customer.email').object.value = app.getForm('login.username').object.value;
    }

    app.getView({
        ContinueURL: URLUtils.https('Account-RegistrationForm')
    }).render('account/user/registration');
}

/**
 * Gets a CustomerModel object wrapping the current customer.
 * Gets a profile form and handles the confirm action.
 *  confirm - validates the profile by checking  that the email and password fields:
 *  - match the emailconfirm and passwordconfirm fields
 *  - are not duplicates of existing username and password fields for the profile
 * If the fields are not valid, the registration template is rendered.
 * If the fields are valid, a new customer account is created, the profile form is cleared and
 * the customer is redirected to the Account-Show controller function.
 */
function registrationForm() {
    app.getForm('profile').handleAction({
        //JIRA PREV - 548: Added error connector in case of invalid email id's.
        error: function () {
            app.getView({
                ContinueURL: URLUtils.https('Account-RegistrationForm')
            }).render('account/user/registration');
        },
        confirm: function () {
            var email, emailConfirmation, profileValidation, password, passwordConfirmation, existingCustomer, Customer, target, month, year,date;
            var cart = app.getModel('Cart').goc();
            Customer = app.getModel('Customer');
            email = app.getForm('profile.customer.email').value();
            emailConfirmation = app.getForm('profile.customer.emailconfirm').value();
            month = app.getForm('profile.customer.month').value();
            year = app.getForm('profile.customer.year').value();
            isAddtoemailChecked = app.getForm('profile.customer.addtoemaillist').value();
            session.custom.addtoemailChecked = isAddtoemailChecked;
            //EASM-50
            if('date' in session.forms.profile.customer)
            date = app.getForm('profile.customer.date').value(); 
            
            if(empty(year))
               year = '1980';
            
            app.getForm('emailsubscribe.birthdate.month').object.value = month;
            app.getForm('emailsubscribe.birthdate.year').object.value = parseInt(year);
           
            if('date' in session.forms.profile.customer){
                	date = parseInt(date)!= 0 ? date : parseInt('01');
                	app.getForm('emailsubscribe.birthdate.day').object.value = date;
                }
            
            if(!empty(date))
            	{
            		var birthdate : Date = new Date(month + "/01/" + year);
            		birthdate.setDate(parseInt(date));
            		app.getForm('profile.customer.birthday').object.value = birthdate ;
            	}
            else{
            	app.getForm('profile.customer.birthday').object.value = new Date(month + "/01/" + year) ;
            }
            profileValidation = true;

            if (email !== emailConfirmation) {
                app.getForm('profile.customer.emailconfirm').invalidate();
                profileValidation = false;
            }

            password = app.getForm('profile.login.password').value();
            passwordConfirmation = app.getForm('profile.login.passwordconfirm').value();

            if (password !== passwordConfirmation) {
                app.getForm('profile.login.passwordconfirm').invalidate();
                profileValidation = false;
            }

            // Checks if login is already taken.
            existingCustomer = Customer.retrieveCustomerByLogin(email);
            if (existingCustomer !== null) {
                app.getForm('profile.customer.email').invalidate();
                profileValidation = false;
            }
            session.custom.formvalidated  = profileValidation;
            if (profileValidation) {
                profileValidation = Customer.createAccount(email, password, app.getForm('profile'));
            }

            /*****************************PREVAIL - Email Sign-up Integration****************************************/
            if (app.getForm('profile.customer.addtoemaillist').value()) {
                emailSignUp();
            }

            

            if (!profileValidation) {

                app.getView({

                    ContinueURL: URLUtils.https('Account-RegistrationForm')
                }).render('account/user/registration');
            } else {
                app.getForm('profile').clear();
                target = session.custom.TargetLocation;
                /*****************************Registration Confirmation - Exact Target Integration****************************************/
                //Changes made as part of EA-1106
                sendCreateAccountEmail(customer);
                session.custom.Signup = true;
                if (target && cart.getProductLineItems().length > 0) {
                    delete session.custom.TargetLocation;
                    //@TODO make sure only path, no hosts are allowed as redirect target
                    dw.system.Logger.info('Redirecting to "{0}" after successful login', target);
                    response.redirect(target);
                } else {
                    response.redirect(URLUtils.https('Account-Show', 'registration', 'true'));
                }
            }
        }
    });
}

/**
 * Renders the accountnavigation template.
 */
function includeNavigation() {
    app.getView().render('account/accountnavigation');
}

/**
 * PREVAIL - Email sign-up integration
 */
function emailSignUp() {
        dw.system.Pipeline.execute('ExactTargetEmailSignUp-MyAccount');
    
}

/**
 * PREVAIL - iCA integration
 */
function createGMCustomer() {
    dw.system.Pipeline.execute('CSSServices-CreateGMCustomerV2');
}

/**
 * Exact Target API call for create account mail.
 */
function sendCreateAccountEmail(Customer) {
    var result = {};
    var pdict = dw.system.Pipeline.execute('ExactTargetWebServices-CreateAndSendTriggeredSend', {
        EmailSubscribers: dw.util.ArrayList(Customer.profile.email),
        MailType: dw.system.Site.getCurrent().getCustomPreferenceValue('exactTargetCreateAccountCustomerKey'),
        MailLibraries: dw.util.ArrayList('int_exacttarget:library/libEmail_CreateAccount.ds'),
        ProductList: null,
        DataHolderString: 'firstname,' + Customer.profile.firstName + '|lastname,' + Customer.profile.lastName + '|UserName,' + Customer.profile.email,
        BackEndJob: 'False'
    });
    result.endNodeName = pdict.EndNodeName;
}

/* Web exposed methods */

function referral() {
	app.getView().render('account/referraldashboard');

}

/** Renders the account overview.
 * @see {@link module:controllers/Account~show} */
exports.Show = guard.ensure(['get', 'https', 'loggedIn'], show);
/** Updates the profile of an authenticated customer.
 * @see {@link module:controllers/Account~editProfile} */
exports.EditProfile = guard.ensure(['get', 'https', 'loggedIn'], editProfile);
/** Handles the form submission on profile update of edit profile.
 * @see {@link module:controllers/Account~editForm} */
exports.EditForm = guard.ensure(['post', 'https', 'loggedIn'], editForm);
/** Renders the password reset dialog.
 * @see {@link module:controllers/Account~passwordResetDialog} */
exports.PasswordResetDialog = guard.ensure(['get', 'https'], passwordResetDialog);
/** Renders the password reset screen.
 * @see {@link module:controllers/Account~passwordReset} */
exports.PasswordReset = guard.ensure(['get', 'https'], passwordReset);
/** Handles the password reset form.
 * @see {@link module:controllers/Account~passwordResetDialogForm} */
exports.PasswordResetDialogForm = guard.ensure(['post', 'https'], passwordResetDialogForm);
/** The form handler for password resets.
 * @see {@link module:controllers/Account~passwordResetForm} */
exports.PasswordResetForm = guard.ensure(['post', 'https'], passwordResetForm);
/** Renders the screen for setting a new password.
 * @see {@link module:controllers/Account~setNewPassword} */
exports.SetNewPassword = guard.ensure(['get', 'https'], setNewPassword);
/** Handles the set new password form submit.
 * @see {@link module:controllers/Account~setNewPasswordForm} */
exports.SetNewPasswordForm = guard.ensure(['post', 'https'], setNewPasswordForm);
/** Start the customer registration process and renders customer registration page.
 * @see {@link module:controllers/Account~startRegister} */
exports.StartRegister = guard.ensure(['https'], startRegister);
/** Handles registration form submit.
 * @see {@link module:controllers/Account~registrationForm} */
exports.RegistrationForm = guard.ensure(['post', 'https'], registrationForm);
/** Renders the account navigation.
 * @see {@link module:controllers/Account~includeNavigation} */
exports.IncludeNavigation = guard.ensure(['get'], includeNavigation);
/* @see {@link module:controllers/Account~sendCreateAccountEmail} */
exports.SendCreateAccountEmail = guard.ensure(['get', 'https'], sendCreateAccountEmail);

exports.Referral = guard.ensure(['get', 'https', 'loggedIn'], referral);
