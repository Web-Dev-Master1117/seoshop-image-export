'use strict';
var Promise = Promise || require("bluebird");
const request = require('superagent-promise')(require('superagent'), Promise);
const prefix = require('superagent-prefix');
const suffix = require('superagent-suffix');
const directorySize = require('directory-size');
const fs = require('fs');

/**
 * Create a get request to seoshop
 * @param path
 * @returns {Request}
 */
function createGetRequest(path) {
    return request
        .get('/' + path)
        .use(prefix('https://api.webshopapp.com/nl'))
        .use(suffix('.json'))
        .auth(process.env.SEOSHOAPIKEY, process.env.SEOSHOPAPISECRET)
        .set('Accept', 'application/json');
}

/**
 * Catch promise errors / rejects
 * @param errorName
 * @returns {Function}
 */
function catchErrors(errorName) {
    return function(error) {
        console.log('Something went wrong with ' + errorName + ': ', error.message);
    }
}

// Request variants
createGetRequest('variants')
    .query({ limit: 250 })
    .query({ page: 1 })
    .then(function parseVariants(result) {
        return result.body.variants.map(function createVariantObject(element) {
            return {
                productId: element.product.resource.id,
                variantEan: element.ean
            }
        })
    })
    .then(function imageImporter(variants) {
        // Loop through the parsed response
        variants.forEach(function loopVariants(variant) {
            // Create directory for product
            new Promise(
                function createDirectory(resolve) {
                    // Create directory path from env variable
                    const directory = process.env.OUTPUTDIRECTORY + '/' + variant.productId + '/';

                    // Create directory if it doesn't exist
                    fs.mkdir(directory, function lookupDirectorySize() {
                        // Check if directory is empty. If it is go further.
                        directorySize(directory).then(function validateDirectorySize(size) {
                            if(size === 0) {
                                resolve(directory);
                            }
                        });
                    })
                }
            ).then(function(directory) {
                // Request images for product
                createGetRequest('products/' + variant.productId + '/images')
                    .query({ limit: 250 })
                    .then(function parseRequest(res) {
                        return res.body.productImages.map(function createImageObject(element) {
                            return element.src
                        })
                    })
                    .then(function getImages(images) {
                        // Loop through images and request them
                        images.forEach(function loopThroughImages(image, index) {
                            // Create filename
                            const filename = variant.variantEan + '-' + index + '.jpg';

                            // Create path
                            const path = directory + filename;
                            // Check if doesn't  already exist and it's size is not 0 bytes
                            new Promise(
                                function checkFile(resolve, reject) {
                                    fs.stat(path, function checkFileStats(err, stats) {
                                        if(err || stats.size === 0) {
                                            resolve();
                                        } else {
                                            reject({ message: 'File already exists' });
                                        }
                                    });
                                }
                            ).then(function() {
                                // Get image and write it to file
                                request.get(image).then(function writeImage(res) {
                                    const imageFileStream = fs.createWriteStream(path);
                                    imageFileStream.end(res.body, function() {
                                        console.log('Written: ' + variant.productId)
                                    })
                                }).catch(catchErrors('images'));
                            }).catch(catchErrors('folder'));
                        })
                    }).catch(catchErrors('products'));
            });
        });
    }).catch(catchErrors('variants'));
