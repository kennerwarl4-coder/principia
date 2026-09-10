(function () {
  'use strict';

  function trackPixelEvent(name, params, eventId) {
    if (typeof window.fbq === 'function') {
      if (eventId) window.fbq('track', name, params, { eventID: eventId });
      else window.fbq('track', name, params);
    }
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  var SUBTOTAL = 137.9;
  var SHIPPING_COSTS = { free: 0, express: 27.9 };

  function formatBRL(amount) {
    return 'R$ ' + amount.toFixed(2).replace('.', ',');
  }

  function getSelectedShipping() {
    var checked = document.querySelector('input[name="pchk-shipping"]:checked');
    return checked ? checked.value : 'free';
  }

  function getShippingCost() {
    return SHIPPING_COSTS[getSelectedShipping()] || 0;
  }

  function getTotalAmount() {
    return Math.round((SUBTOTAL + getShippingCost()) * 100) / 100;
  }

  function getProducts() {
    var nameEl = document.querySelector('.pchk-cart-name');
    if (!nameEl) return [];
    return [{ id: '1', name: nameEl.textContent.trim(), quantity: 1, price: SUBTOTAL }];
  }

  function updateTotalsDisplay() {
    var freteEl = document.getElementById('pchk-frete-value');
    var totalEl = document.getElementById('pchk-total-value');
    var subtotalEl = document.getElementById('pchk-subtotal-value');
    var cartPriceEl = document.querySelector('.pchk-cart-price');
    var cost = getShippingCost();
    if (freteEl) {
      freteEl.textContent = cost > 0 ? formatBRL(cost) : 'Grátis';
      freteEl.classList.toggle('pchk-free', cost === 0);
    }
    if (subtotalEl) subtotalEl.textContent = formatBRL(SUBTOTAL);
    if (cartPriceEl) cartPriceEl.textContent = formatBRL(SUBTOTAL);
    if (totalEl) totalEl.textContent = formatBRL(getTotalAmount());
  }

  function onlyDigits(value) {
    return (value || '').replace(/\D/g, '');
  }

  function maskPhone(value) {
    var d = onlyDigits(value).slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function maskCPF(value) {
    var d = onlyDigits(value).slice(0, 11);
    var out = d.slice(0, 3);
    if (d.length > 3) out += '.' + d.slice(3, 6);
    if (d.length > 6) out += '.' + d.slice(6, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }

  function maskCEP(value) {
    var d = onlyDigits(value).slice(0, 8);
    if (d.length > 5) return d.slice(0, 5) + '-' + d.slice(5);
    return d;
  }

  function applyMask(el, formatter) {
    if (!el) return;
    el.addEventListener('input', function () {
      var formatted = formatter(el.value);
      if (formatted !== el.value) el.value = formatted;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var app = document.querySelector('.pchk');
    if (!app) return;

    trackPixelEvent('InitiateCheckout', {
      value: getTotalAmount(),
      currency: 'BRL',
      contents: getProducts().map(function (p) { return { id: p.id, quantity: p.quantity }; }),
      content_type: 'product',
    });

    var ctaBtn = document.getElementById('pchk-cta-btn');
    var ctaLabel = document.getElementById('pchk-cta-label');
    var progressSteps = app.querySelectorAll('.pchk-progress-step');
    var stepSections = {
      1: document.getElementById('pchk-step-1'),
      2: document.getElementById('pchk-step-2'),
      3: document.getElementById('pchk-step-3'),
    };
    var stepBodies = {
      1: document.getElementById('pchk-form-1'),
      2: document.getElementById('pchk-form-2'),
      3: document.getElementById('pchk-payment-body'),
    };
    var stepSummaries = {
      1: stepSections[1].querySelector('.pchk-step-summary'),
      2: stepSections[2].querySelector('.pchk-step-summary'),
    };
    var editBtns = app.querySelectorAll('.pchk-edit-btn');
    var errorEls = {
      1: document.getElementById('pchk-error-1'),
      2: document.getElementById('pchk-error-2'),
      3: document.getElementById('pchk-error-3'),
    };

    var fields1 = {
      name: document.getElementById('pix-name'),
      email: document.getElementById('pix-email'),
      phone: document.getElementById('pix-phone'),
      document: document.getElementById('pix-document'),
    };
    var fields2 = {
      cep: document.getElementById('pchk-cep'),
      city: document.getElementById('pchk-city'),
      address: document.getElementById('pchk-address'),
      complement: document.getElementById('pchk-complement'),
      state: document.getElementById('pchk-state'),
    };

    applyMask(fields1.phone, maskPhone);
    applyMask(fields1.document, maskCPF);
    applyMask(fields2.cep, maskCEP);

    var cepHint = document.getElementById('pchk-cep-hint');
    var lastLookedUpCep = '';

    function showCepHint(text, isError) {
      if (!cepHint) return;
      cepHint.textContent = text;
      cepHint.hidden = !text;
      cepHint.classList.toggle('is-error', !!isError);
    }

    if (fields2.cep) {
      fields2.cep.addEventListener('blur', function () {
        var digits = onlyDigits(fields2.cep.value);
        if (digits.length !== 8 || digits === lastLookedUpCep) return;
        lastLookedUpCep = digits;
        showCepHint('Buscando endereço…', false);
        fetch('https://viacep.com.br/ws/' + digits + '/json/')
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (data.erro) {
              showCepHint('CEP não encontrado — preencha manualmente.', true);
              return;
            }
            if (data.localidade) fields2.city.value = data.localidade;
            if (data.uf) fields2.state.value = data.uf;
            var street = [data.logradouro, data.bairro].filter(Boolean).join(', ');
            if (street && !fields2.address.value.trim()) fields2.address.value = street;
            showCepHint('Endereço encontrado.', false);
          })
          .catch(function () {
            showCepHint('Não foi possível buscar o CEP — preencha manualmente.', true);
          });
      });
    }

    var resultEl = document.getElementById('pix-result');
    var qrImage = document.getElementById('pix-qr-image');
    var copyInput = document.getElementById('pix-copy-code');
    var copyBtn = document.getElementById('pix-copy-btn');
    var statusEl = document.getElementById('pix-status');
    var amountDueEl = document.getElementById('pix-amount-due');
    var shippingRadios = app.querySelectorAll('input[name="pchk-shipping"]');

    shippingRadios.forEach(function (radio) {
      radio.addEventListener('change', updateTotalsDisplay);
    });

    updateTotalsDisplay();

    function enterPixFocusMode(amount) {
      app.classList.add('is-pix-focus');
      if (amountDueEl) amountDueEl.textContent = formatBRL(amount);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    var currentStep = 1;
    var pixGenerated = false;
    var purchaseTracked = false;
    var currentEventId = null;

    function showError(step, message) {
      var el = errorEls[step];
      el.textContent = message;
      el.hidden = !message;
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function validateStep1() {
      var name = fields1.name.value.trim();
      var email = fields1.email.value.trim();
      var phoneDigits = onlyDigits(fields1.phone.value);
      var docDigits = onlyDigits(fields1.document.value);

      if (name.length < 3) return 'Informe seu nome completo.';
      if (!isValidEmail(email)) return 'Informe um e-mail válido.';
      if (phoneDigits.length < 10 || phoneDigits.length > 11) return 'Informe um telefone válido com DDD.';
      if (docDigits.length !== 11 && docDigits.length !== 14) return 'Informe um CPF válido.';
      return null;
    }

    function validateStep2() {
      var cepDigits = onlyDigits(fields2.cep.value);
      if (cepDigits.length !== 8) return 'Informe um CEP válido.';
      if (!fields2.address.value.trim()) return 'Informe o endereço (rua, número, bairro).';
      if (!fields2.city.value.trim()) return 'Informe a cidade.';
      if (onlyDigits(fields2.state.value).length !== 0 || fields2.state.value.trim().length !== 2) return 'Informe o estado (UF), com 2 letras.';
      return null;
    }

    function setProgress(step, isDone) {
      progressSteps.forEach(function (li) {
        var n = Number(li.getAttribute('data-progress'));
        li.classList.toggle('is-active', n === step);
        li.classList.toggle('is-done', n < step || (n === step && isDone));
      });
    }

    function summaryForStep1() {
      return fields1.name.value.trim() + ' · ' + fields1.email.value.trim();
    }

    function summaryForStep2() {
      var uf = fields2.state.value.trim().toUpperCase();
      var shippingLabel = getSelectedShipping() === 'express' ? 'Frete Expresso (R$ 27,90)' : 'Frete Grátis';
      return fields2.address.value.trim() + ' — ' + fields2.city.value.trim() + '/' + uf + ' · ' + shippingLabel;
    }

    function goToStep(step, shouldScroll) {
      currentStep = step;
      setProgress(step, false);

      [1, 2, 3].forEach(function (n) {
        var section = stepSections[n];
        section.classList.toggle('is-active', n === step);
        section.classList.toggle('is-locked', n > step);
        section.classList.toggle('is-done', n < step);

        if (stepBodies[n]) stepBodies[n].hidden = n !== step;
        if (stepSummaries[n]) stepSummaries[n].hidden = n >= step;
      });

      if (editBtns.length) {
        editBtns.forEach(function (btn) {
          var n = Number(btn.getAttribute('data-edit'));
          btn.hidden = n >= step;
        });
      }

      if (stepSummaries[1] && step > 1) stepSummaries[1].textContent = summaryForStep1();
      if (stepSummaries[2] && step > 2) stepSummaries[2].textContent = summaryForStep2();

      if (step === 1) ctaLabel.textContent = 'Ir para entrega →';
      else if (step === 2) ctaLabel.textContent = 'Ir para pagamento →';
      else if (step === 3 && !pixGenerated) ctaLabel.textContent = 'Confirmar pedido';

      if (shouldScroll !== false) {
        var activeSection = stepSections[step];
        if (activeSection) activeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    editBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        goToStep(Number(btn.getAttribute('data-edit')));
      });
    });

    var pollTimer = null;
    var currentTransactionId = null;
    var checkNowBtn = document.getElementById('pix-check-now-btn');

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function setStatus(text, className) {
      statusEl.textContent = text;
      statusEl.className = 'pix-status' + (className ? ' ' + className : '');
    }

    function checkStatusOnce(transactionId) {
      return fetch('/api/pix/status/' + encodeURIComponent(transactionId))
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.status === 'COMPLETED') {
            setStatus('Pagamento confirmado! Seu pedido foi aprovado.', 'is-paid');
            ctaBtn.disabled = true;
            ctaLabel.textContent = 'Pedido confirmado';
            if (checkNowBtn) checkNowBtn.hidden = true;
            if (!purchaseTracked) {
              purchaseTracked = true;
              trackPixelEvent('Purchase', {
                value: getTotalAmount(),
                currency: 'BRL',
                contents: getProducts().map(function (p) { return { id: p.id, quantity: p.quantity }; }),
                content_type: 'product',
              }, currentEventId);
            }
            stopPolling();
          } else if (data.status === 'FAILED' || data.status === 'REFUNDED' || data.status === 'CHARGED_BACK') {
            setStatus('Pagamento não concluído (' + data.status + ').', 'is-failed');
            ctaBtn.disabled = false;
            ctaLabel.textContent = 'Tentar novamente';
            pixGenerated = false;
            stopPolling();
          } else {
            setStatus('Aguardando pagamento…');
          }
        })
        .catch(function () {
          /* mantém tentando na próxima checagem */
        });
    }

    function pollStatus(transactionId) {
      stopPolling();
      currentTransactionId = transactionId;
      checkStatusOnce(transactionId);
      pollTimer = setInterval(function () {
        checkStatusOnce(transactionId);
      }, 5000);
    }

    if (checkNowBtn) {
      checkNowBtn.addEventListener('click', function () {
        if (!currentTransactionId) return;
        var restoreLabel = checkNowBtn.textContent;
        checkNowBtn.disabled = true;
        checkNowBtn.textContent = 'Verificando…';
        checkStatusOnce(currentTransactionId).finally(function () {
          checkNowBtn.disabled = false;
          checkNowBtn.textContent = restoreLabel;
        });
      });
    }

    function generatePix() {
      showError(3, '');

      var amount = getTotalAmount();
      currentEventId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      ctaBtn.disabled = true;
      ctaLabel.textContent = 'Gerando Pix…';

      fetch('/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          shippingFee: getShippingCost(),
          client: {
            name: fields1.name.value.trim(),
            email: fields1.email.value.trim(),
            phone: fields1.phone.value.trim(),
            document: fields1.document.value.trim(),
          },
          products: getProducts(),
          tracking: typeof window.principiaGetTracking === 'function' ? window.principiaGetTracking() : {},
          meta: {
            eventId: currentEventId,
            fbp: getCookie('_fbp'),
            fbc: getCookie('_fbc'),
          },
        }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) throw new Error(data.message || 'Erro ao gerar Pix.');
            return data;
          });
        })
        .then(function (data) {
          pixGenerated = true;
          qrImage.src = data.pix.qrImage;
          copyInput.value = data.pix.code;
          resultEl.hidden = false;
          setStatus('Aguardando pagamento…');
          ctaLabel.textContent = 'Aguardando pagamento…';
          enterPixFocusMode(amount);
          pollStatus(data.transactionId);
        })
        .catch(function (error) {
          showError(3, error.message || 'Erro ao gerar Pix. Tente novamente.');
          ctaBtn.disabled = false;
          ctaLabel.textContent = 'Confirmar pedido';
        });
    }

    ctaBtn.addEventListener('click', function () {
      if (currentStep === 1) {
        var err1 = validateStep1();
        if (err1) { showError(1, err1); return; }
        showError(1, '');
        goToStep(2);
      } else if (currentStep === 2) {
        var err2 = validateStep2();
        if (err2) { showError(2, err2); return; }
        showError(2, '');
        goToStep(3);
      } else if (currentStep === 3 && !pixGenerated) {
        generatePix();
      }
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyInput.select();
        copyInput.setSelectionRange(0, copyInput.value.length);
        var restoreLabel = copyBtn.textContent;
        var done = function () {
          copyBtn.textContent = 'Copiado!';
          setTimeout(function () { copyBtn.textContent = restoreLabel; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(copyInput.value).then(done).catch(function () {
            document.execCommand('copy');
            done();
          });
        } else {
          document.execCommand('copy');
          done();
        }
      });
    }

    goToStep(1, false);
  });
})();
