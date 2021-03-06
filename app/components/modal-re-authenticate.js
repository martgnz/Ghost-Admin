import $ from 'jquery';
import ModalComponent from 'ghost-admin/components/modal-base';
import ValidationEngine from 'ghost-admin/mixins/validation-engine';
import {computed} from '@ember/object';
import {htmlSafe} from '@ember/string';
import {isVersionMismatchError} from 'ghost-admin/services/ajax';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';

export default ModalComponent.extend(ValidationEngine, {
    validationType: 'signin',

    authenticationError: null,

    config: service(),
    notifications: service(),
    session: service(),

    identification: computed('session.user.email', function () {
        return this.get('session.user.email');
    }),

    _authenticate() {
        let session = this.get('session');
        let authStrategy = 'authenticator:oauth2';
        let identification = this.get('identification');
        let password = this.get('password');

        session.set('skipAuthSuccessHandler', true);

        this.toggleProperty('submitting');

        return session.authenticate(authStrategy, identification, password).finally(() => {
            this.toggleProperty('submitting');
            session.set('skipAuthSuccessHandler', undefined);
        });
    },

    _passwordConfirm() {
        // Manually trigger events for input fields, ensuring legacy compatibility with
        // browsers and password managers that don't send proper events on autofill
        $('#login').find('input').trigger('change');

        this.set('authenticationError', null);

        return this.validate({property: 'signin'}).then(() => {
            return this._authenticate().then(() => {
                this.get('notifications').closeAlerts();
                this.send('closeModal');
                return true;
            }).catch((error) => {
                if (error && error.payload && error.payload.errors) {
                    error.payload.errors.forEach((err) => {
                        if (isVersionMismatchError(err)) {
                            return this.get('notifications').showAPIError(error);
                        }
                        err.message = htmlSafe(err.context || err.message);
                    });

                    this.get('errors').add('password', 'Incorrect password');
                    this.get('hasValidated').pushObject('password');
                    this.set('authenticationError', error.payload.errors[0].message);
                }
            });
        }, () => {
            this.get('hasValidated').pushObject('password');
            return false;
        });
    },

    reauthenticate: task(function* () {
        return yield this._passwordConfirm();
    }).drop(),

    actions: {
        confirm() {
            this.get('reauthenticate').perform();
        }
    }
});
