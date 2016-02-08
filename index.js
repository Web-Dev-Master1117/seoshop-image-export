'use strict';
var Promise = Promise || require("bluebird");
const request = require('superagent-promise')(require('superagent'), Promise);
const prefix = require('superagent-prefix')('http://api.webshopapp.com/nl');
const fs = require('fs');

function createGetRequest(path) {
    return request
        .get(path)
        .use(prefix)
        .auth(process.env.SEOSHOAPIKEY, process.env.SEOSHOPAPISECRET)
        .set('Accept', 'application/json')
}

createGetRequest('/variants.json')
    .then(function parseVariants(result) {
        return result.body.variants.map(function createVariantObject(element) {
            return {
                productId: element.product.resource.id,
                variantEan: element.ean,
                variantSku: element.sku
            }
        })
    })
    .then(function getImages(variants) {
        variants.forEach(function(variant) {
            createGetRequest('/products/' + variant.productId + '/images.json')
                .then(function(res) {
                    return res.body.productImages.map(function createImageObject(element) {
                        return element.src
                    })
                })
                .then(function(images) {
                    images.forEach(function(image) {
                        var imageFileStream = fs.createWriteStream(process.env.OUTPUTDIRECTORY + variant.productId + '.jpg');
                        request.get(image).then(function(res) {
                            imageFileStream.end(res.body, function() {
                                console.log('Written: ' + variant.productId);
                            })
                        })
                    })
                })
        });
    })
    .catch(function catchErrors(err) {
        console.log('Something went wrong', err);
    });