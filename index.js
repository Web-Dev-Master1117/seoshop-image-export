'use strict';
var Promise = Promise || require("bluebird");
const request = require('superagent-promise')(require('superagent'), Promise);
const prefix = require('superagent-prefix');
const fs = require('fs');

const directorySize = require('directory-size');


function createGetRequest(path) {
    return request
        .get(path)
        .use(prefix('http://api.webshopapp.com/nl'))
        .auth(process.env.SEOSHOAPIKEY, process.env.SEOSHOPAPISECRET)
        .set('Accept', 'application/json')
}

createGetRequest('/variants.json')
    .query({ limit: 250 })
    .query({ page: 1 })
    .then(function parseVariants(result) {
        return result.body.variants.map(function createVariantObject(element) {
            return {
                productId: element.product.resource.id,
                variantEan: element.ean,
                variantSku: element.sku
            }
        })
    })
    .then(function(variants) {
        variants.forEach(function(variant) {
            const directory = process.env.OUTPUTDIRECTORY + '/' + variant.productId + '/';
            new Promise(
                function(resolve) {
                    fs.mkdir(directory, function() {
                        directorySize(directory).then(function(size) {
                            if(size === 0) {
                                resolve();
                            }
                        });
                    })
                }
            ).then(function() {
                createGetRequest('/products/' + variant.productId + '/images.json')
                    .query({ limit: 250 })
                    .then(function parseRequest(res) {
                        return res.body.productImages.map(function createImageObject(element) {
                            return element.src
                        })
                    })
                    .then(function getImages(images) {
                        images.forEach(function loopThroughImages(image, index) {
                            const filename = variant.variantEan + '-' + index + '.jpg';
                            const path = directory + filename;
                            new Promise(
                                function checkFile(resolve, reject) {
                                    fs.stat(path + filename, function checkFileStats(err, stats) {
                                        if(err || stats.size === 0) {
                                            resolve();
                                        } else {
                                            reject({
                                                message: 'File already exists'
                                            });
                                        }
                                    });
                                }
                            ).then(function() {
                                request.get(image).then(function(res) {
                                    const imageFileStream = fs.createWriteStream(path);
                                    imageFileStream.end(res.body, function() {
                                        console.log('Written: ' + variant.productId)
                                    })
                                }).catch(function(err) {
                                    console.log('Error gettings image data: ', err.message)
                                });
                            }).catch(function(err) {
                                console.log('Error occured', err)
                            });

                        })
                    }).catch(function(err) {
                        console.log('Something went wrong requesting images: ', err.message);
                    })
            });
        });
    })
    .catch(function catchErrors(err) {
        console.log('Something went wrong: ', err.message);
    });