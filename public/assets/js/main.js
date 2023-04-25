// @ts-nocheck
function auth(e) {
    e.preventDefault();
    const $this = $(e.target);
    const $form = $this.serialize();
    $this.find('input.form-control').removeClass('is-invalid');
    $this.find('.invalid-feedback').remove();
    $this.find('.alert-danger').remove();
    $.ajax({
        url: '/login',
        dataType: 'JSON',
        data: $form,
        method: 'POST',
        beforeSend: function () {
            $this.find('button.submitBtn').html(` <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`);
            $this.find('button.submitBtn').prop('disabled', true);
        },
        success: function (res) {
            // setTimeout(() => {
            //     $this.find('button.submitBtn').html('Login')
            //     $this.find('button.submitBtn').prop('disabled', false);
            // }, 1000);
            window.location = res.url
        },
        error: function (err) {
            let errs = err?.responseJSON?.errors || err?.errors;
            if (typeof errs === 'object') {
                if (errs[0]?.param) {
                    $(`#${errs[0]?.param}`).after(`<div class="invalid-feedback">
                    ${errs[0].msg}
                  </div>`)
                    $(`#${errs[0]?.param}`).addClass('is-invalid');
                    $(`#${errs[0]?.param}`).focus();
                } else {
                    $this.prepend(`<div class="alert alert-danger">${errs.message || 'Something went wrong. Please try again'}</div>`)
                }
            } else {
                $this.prepend(`<div class="alert alert-danger" role="alert">${errs}</div>`);
            }
            $this.find('button.submitBtn').html('Login')
            $this.find('button.submitBtn').prop('disabled', false);
            setTimeout(() => {
                $this.find('.alert-danger').remove();
                $this.find('input.form-control').removeClass('is-invalid');
                $this.find('.invalid-feedback').remove();
            }, 3000);
        }
    })
}



