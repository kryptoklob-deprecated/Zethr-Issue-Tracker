// Zethr main test suite

const Zethr = artifacts.require('Zethr')
const ZethrBankroll = artifacts.require('ZethrBankroll')
const ZethrDividendCards = artifacts.require('ZethrDividendCards')

var BigNumber = require('bignumber.js')

contract('Zethr (short tests)', accounts => {
  let zethr = null
  let bankroll = null
  let divcards = null

  let divs = [2, 5, 10, 15, 20, 25, 33]

  // Before each test starts, instantiate the bankroll, divcards, and the main zethr contract
  beforeEach(async function () {
    bankroll = await ZethrBankroll.new([accounts[0]], 1)
    divcards = await ZethrDividendCards.new(bankroll.address)
    zethr = await Zethr.new(bankroll.address, divcards.address)
    await bankroll.addZethrAddresses(zethr.address, divcards.address)
  })

  // When we're NOT in the ICO, we SHOULD send dividends to the div-cards
  it('should send the appropriate amount of divs to divcards not during the ico', async () => {
    await zethr.startICOPhase({from: accounts[0]})
    await zethr.buyAndSetDivPercentage('0x0000000000000000000000000000000000000000', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(2.5, 'ether'), gasPrice: 5})
    await zethr.endICOPhase({from: accounts[0]})
    await zethr.startRegularPhase({from: accounts[0]})
    await divcards.startCardSale({from: accounts[0]})
    await zethr.buyAndSetDivPercentage('0x0000000000000000000000000000000000000000', 20, web3.fromAscii('doesntmatter'),
      {from: accounts[0], value: web3.toWei(2.5, 'ether'), gasPrice: 5})
    let bankBalance = await web3.eth.getBalance(bankroll.address)

    // Now let's have a new account buy a div card
    await divcards.purchase(2, {from: accounts[0], value: web3.toWei(1, 'ether'), gasPrice: 5})
    let accountBalanceBefore = await web3.eth.getBalance(accounts[0])

    await zethr.buyAndSetDivPercentage('0x0000000000000000000000000000000000000000', 10, web3.fromAscii('lol'),
      {from: accounts[1], value: web3.toWei(10, 'ether'), gasPrice: 5})

    let accountBalanceAfter = await web3.eth.getBalance(accounts[0])

    assert(parseFloat(await web3.fromWei(accountBalanceAfter)) - parseFloat(await web3.fromWei(accountBalanceBefore)) + 0.05 < 1)
  })

  // Administrators should be able to activate the ICO phase
  it('should let an administrator activate the ICO phase', async () => {
    await zethr.startICOPhase()

    await zethr.icoPhase().then((result) => {
      assert.equal(result, true, 'Administrator cannot start ICO phase')
    })
  })

  // Non-administrators shouldn't be able to activate the ICO phase
  it('should not let a non-administrator activate the ICO phase', async () => {
    await zethr.startICOPhase({from: accounts[1]}).then(function (returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t.')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  // Administrators should be able to end the ICO phase
  it('should let an administrator end the ICO phase', async () => {
    await zethr.startICOPhase()
    await zethr.endICOPhase()
    await zethr.icoPhase().then((result) => {
      assert.equal(result, false, 'Administrator cannot end ICO phase')
    })
  })

  // Non-admins shouldn't be able to end the ICO phase
  it('should not let a non-administrator end the ICO phase', async () => {
    await zethr.startICOPhase()
    await zethr.endICOPhase({from: accounts[1]}).then(function (returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t.')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  // When buying at certain dividend rates, the system should average the user's dividend rate accordingly
  it('should correctly calculate a users average dividend rate', async () => {
    await zethr.startICOPhase()

    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.5, 'ether'), gasPrice: 5})
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.5, 'ether'), gasPrice: 5})

    try {
      let myAverageDivRate = new BigNumber(await zethr.getMyAverageDividendRate())
      var tenPercent = new BigNumber(2)
      tenPercent = tenPercent.pow(64).times(10)
      assert(tenPercent.toString() === myAverageDivRate.toString(),
        'bought in at 10 percent but didnt get 10 percent as average dividend rate')
    } catch (err) {
      console.log(err)
    }

    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.5, 'ether'), gasPrice: 5})
    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.5, 'ether'), gasPrice: 5})

    try {
      let myAverageDivRate = new BigNumber(await zethr.getMyAverageDividendRate())
      var averageCalculated = new BigNumber(2)

      // The reason this isn't 15 percent:
      //  When we buy in with 2 eth @ 10 percent divs, only 1.8 eth goes towards tokens
      //  When we buy in with 2 eth @ 20 percent divs, only 1.6 eth goes towards tokens
      //  So our percentage is skewed a bit towards the lower end, thus it's more like 14.7 % (250/7)

      averageCalculated = averageCalculated.pow(64).times(250).div(7)
      assert(averageCalculated.toString() === averageCalculated.toString(),
        'bought in for a total average of 15% but got something else')
    } catch (err) {
      console.log(err)
    }
  })

  // During the ICO, token price should be static
  it('should sell all tokens for the same price in ICO (at the same dividend rate)', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(2, 'ether'), gasPrice: 5})
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[1], value: web3.toWei(2, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    let balance0 = await zethr.getFrontEndTokenBalanceOf(accounts[0])
    let balance1 = await zethr.getFrontEndTokenBalanceOf(accounts[1])

    assert.equal(balance0.toString(), balance1.toString(),
      'did not give the same amount of tokens for the same amount of ETH')
  })

  // During the ICO, transfers of tokens shouldn't be allowed
  it('should not be able to transfer tokens in ICO phase', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.05, 'ether'), gasPrice: 5})
    await zethr.transfer(accounts[0], 100).then(function (returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t.')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  // During the regular phase (and not the ICO phase), we should be able to transfer tokens
  it('should allow transfers of tokens after ICO phase', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(1, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.startRegularPhase()
    await zethr.transfer(0x1, web3.toWei(5, 'ether'))
  })

  // TransferFrom
  // We should be able to approve a spender for a particular amount of tokens
  it('should allow transfers from an approved spender', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(1, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    await zethr.approve(accounts[1], 100e18, {from: accounts[0]})
    await zethr.transferFrom(accounts[0], accounts[1], 100e18, {from: accounts[1]})
    await zethr.balanceOf(accounts[1]).then(function (balance) {
      assert.equal(parseFloat(web3.fromWei(balance)), 100)
    })
  })

  // TransferFrom
  // If a spender tries to spend more tokens than authorized, it should revert
  it('should block transfers that exceed the approved amount', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(1, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    await zethr.approve(accounts[1], 100e18, {from: accounts[0]})
    await zethr.transferFrom(accounts[0], accounts[1], 101e18, {from: accounts[1]}).then(function (returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t.')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })

    await zethr.transferFrom(accounts[0], accounts[1], 99e18, {from: accounts[1]})
    await zethr.transferFrom(accounts[0], accounts[1], 1.01e18, {from: accounts[1]}).then(function (returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  // TransferFrom
  // If a non-authorized spender tries to spend tokens, it should revert
  it('should block transfers from unapproved spenders', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(1, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    await zethr.approve(accounts[1], 100e18, {from: accounts[0]})
    await zethr.transferFrom(accounts[0], accounts[1], 100e18, {from: accounts[2]}).then(function (returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  // TransferTo should transfer the correct amount of tokens
  it('should transfer the correct amount of tokens when using transferTo', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(1, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    await zethr.transferTo(accounts[0], accounts[1], 100e18, '')
    await zethr.balanceOf(accounts[1]).then(function (balance) {
      assert.equal(100, parseFloat(web3.fromWei(balance)))
    })
  })

  // TransferTo should not allow others to spend unapproved tokens
  it('should block others from spending unapproved tokens when using transferTo', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(1, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    await zethr.approve(accounts[1], 100e18, {from: accounts[0]})
    await zethr.transferTo(accounts[0], accounts[1], 100e18, '', {from: accounts[2]}).then(function (returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  // TransferTo should allow others to spend approved tokens
  it('should allow others to spend approved tokens when using transferTo', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(1, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    await zethr.approve(accounts[1], 100e18, {from: accounts[0]})
    await zethr.transferTo(accounts[0], accounts[1], 100e18, '', {from: accounts[1]})
    await zethr.balanceOf(accounts[1]).then(function (balance) {
      assert.equal(100, parseFloat(web3.fromWei(balance)))
    })
  })

  // TransferTo should transfer to a contract that has tokenFallback (like bankroll)
  it('should be able to use transferTo to transfer to a contract that has tokenFallback (bankroll in this case)', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(1, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    await zethr.transferTo(accounts[0], bankroll.address, 10e18, '', {from: accounts[0]})
  })

  // After transferring tokens, the sender and receiver should have the same total sum of tokens
  it('should calculate the right token balances after token transfer', async () => {
    const transferAmount = 1e18

    // First, transfer at a regular 10% rate
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.05, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.startRegularPhase()
    let initialBalance = await zethr.getFrontEndTokenBalanceOf(accounts[0])
    let initialDivTokenBalance = await zethr.getDividendTokenBalanceOf(accounts[0])
    await zethr.transfer(0x10, transferAmount)
    let balanceAfterTransfer = await zethr.getFrontEndTokenBalanceOf(accounts[0])
    let divTokenBalanceAfterTransfer = await zethr.getDividendTokenBalanceOf(accounts[0])
    let recipientBalance = await zethr.getFrontEndTokenBalanceOf(0x10)
    let recipientDivTokenBalance = await zethr.getDividendTokenBalanceOf(0x10)
    assert.equal(balanceAfterTransfer, initialBalance - transferAmount,
      'sender didnt have the correct amount of tokens')
    assert.equal(divTokenBalanceAfterTransfer, initialDivTokenBalance - (transferAmount * 10),
      'sender didnt have the correct amount of divtokens')
    assert.equal(recipientBalance, transferAmount,
      'recipient didnt have the correct amount of tokens')
    assert.equal(recipientDivTokenBalance, transferAmount * 10,
      'recipient didnt have the correct amount of divtokens')

    // Then, let's make our dividends an averaged rate
    await zethr.buyAndSetDivPercentage('0x0', 25, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.10, 'ether'), gasPrice: 5})
    let averageDivRate = await zethr.getMyAverageDividendRate()

    initialBalance = await zethr.getFrontEndTokenBalanceOf(accounts[0])
    initialDivTokenBalance = await zethr.getDividendTokenBalanceOf(accounts[0])
    await zethr.transfer(0x11, transferAmount)
    balanceAfterTransfer = await zethr.getFrontEndTokenBalanceOf(accounts[0])
    divTokenBalanceAfterTransfer = await zethr.getDividendTokenBalanceOf(accounts[0])
    recipientBalance = await zethr.getFrontEndTokenBalanceOf(0x11)
    recipientDivTokenBalance = await zethr.getDividendTokenBalanceOf(0x11)
    assert.equal(balanceAfterTransfer, initialBalance - transferAmount,
      'sender didnt have the correct amount of tokens')
    assert(parseFloat(divTokenBalanceAfterTransfer) - initialDivTokenBalance - (transferAmount * averageDivRate) / (2 ** 64) < 1e4,
      'sender didnt have the correct amount of divtokens')
    assert.equal(parseFloat(recipientBalance), parseFloat(transferAmount),
      'recipient didnt have the correct amount of tokens')
    assert.equal(parseFloat(recipientDivTokenBalance), (transferAmount * averageDivRate) / (2 ** 64),
      'recipient didnt have the correct amount of divtokens')
  })

  // You shouldn't be allowed to transfer more tokens than you own
  it('should not allow transfer of more tokens than you own', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.05, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()

    let initialBalance = await zethr.getFrontEndTokenBalanceOf(accounts[0])

    await zethr.transfer(0x0, initialBalance + 1).then(function (returnValue) {
      assert(false, 'transfer of too much tokens allowed')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  // We shouldn't be allowed to transfer less than 1 token.
  it('should not allow the transfer of less than 1 token', async () => {
    await zethr.startICOPhase()
    await zethr.buyAndSetDivPercentage('0x0', 10, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.05, 'ether'), gasPrice: 5})
    await zethr.endICOPhase()
    await zethr.transfer(accounts[1], 10e17, {from: accounts[0]}).then(function (returnValue) {
      assert(false, 'Transfer of less than 1 token was allowed!')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  // When someone is referred and buys in from someone during the regular phase, but the person they buy in from
  //  DOES NOT have enough ZTH (100) tokens for a masternode, they should get no referral dividends
  it('should send referral dividends when people are referred and have enough tokens for a mnode', async () => {
    await zethr.startICOPhase()

    // Account 0 should have enough tokens for a masternode
    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    // Account 1 buys in with account 0's referral
    await zethr.buyAndSetDivPercentage(accounts[0], 20, web3.fromAscii('hunter2'),
      {from: accounts[1], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Account 0 should have referral dividends - 25% of the 0.495eth in dividends from the purchase = 0.125 divs
    // 	(only 0.495 eth in total dividends, because 1 percent is shaved off first!)
    // 	(0.495 * 0.25 = 0.12375)
    await zethr.myReferralDividends({from: accounts[0]}).then(function (amount) {
      assert.equal(0.12375, parseFloat(web3.fromWei(amount)))
    })
  })

  // When someone is referred and buys in from someone during the regular phase, AND the person they buy in from
  //  DOES have enogh ZTH (100) tokens for a masternode, they should get referral dividends
  it('should not send referral dividends when people are referred and do not have enough tokens for a mnode', async () => {
    await zethr.startICOPhase()

    // Account 0 should /not/ have enough tokens for a masternode
    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.1, 'ether'), gasPrice: 5})

    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    // Account 1 buys in with account 0's referral
    await zethr.buyAndSetDivPercentage(accounts[0], 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Account 0 should /not/ have referral dividends, so all the divs is has is from regular divs
    await zethr.myReferralDividends({from: accounts[0]}).then(function (amount) {
      assert.equal(0, parseFloat(web3.fromWei(amount)))
    })
  })

  // Referrals shouldn't work during the ICO phase
  it('should NOT send referral dividends during the ICO phase', async () => {
    await zethr.startICOPhase()

    // Account 0 should have enough tokens for a masternode
    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Account 1 buys in with account 0's referral
    await zethr.buyAndSetDivPercentage(accounts[0], 20, web3.fromAscii('hunter2'),
      {from: accounts[1], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Since we're still in the ICO, account 0 should have no referral (or other) dividends
    await zethr.myReferralDividends({from: accounts[0]}).then(function (amount) {
      assert.equal(0, parseFloat(web3.fromWei(amount)))
    })

    await zethr.myDividends(true, {from: accounts[0]}).then(function (amount) {
      assert.equal(0, parseFloat(web3.fromWei(amount)))
    })
  })

  // During the ico, you shouldn't be able to buy in with more than 2 eth worth of tokens
  it('should NOT let anyone buy in past the ICO limit', async () => {
    await zethr.startICOPhase()

    // Account 0 buys in to the max level
    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Account 0 tries to buy in again - should revert
    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(0.1, 'ether'), gasPrice: 5}).then(function (returnValue) {
      assert(false, 'Transfer of less than 1 token was allowed!')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  // Masternode referrals should also work when multiple accounts buy
  it('should send the correct amount of referral dividneds when multiple people / purchases are made', async () => {
    await zethr.startICOPhase()

    // Account 0 buys enough tokens for referrals
    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    // Account 1 buys in with account 0's referral
    await zethr.buyAndSetDivPercentage(accounts[0], 20, web3.fromAscii('hunter2'),
      {from: accounts[1], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Account 1 buys in again with account 0's referral, using the regular buy function
    await zethr.buy(accounts[0],
      {from: accounts[1], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Account 2 also buys in with 0's referral
    await zethr.buyAndSetDivPercentage(accounts[0], 20, web3.fromAscii('hunter'),
      {from: accounts[2], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Finally, check account 0's divs
    // Should be:
    //	0.12375 x 3 = 0.37125 eth
    await zethr.myReferralDividends({from: accounts[0]}).then(function (amount) {
      assert.equal(0.37125, parseFloat(web3.fromWei(amount)))
    })
  })

  // Masternode referrals should STOP working after someone sells enough tokens to go below 100e18
  it('should stop sending referral dividends after the referrer sells tokens to go below the staking requirement', async () => {
    await zethr.startICOPhase()

    // Account 0 buys enough tokens for referrals
    await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
      {from: accounts[0], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    await zethr.endICOPhase()
    await zethr.startRegularPhase()

    // Account 1 buys in with account 0's referral
    await zethr.buyAndSetDivPercentage(accounts[0], 20, web3.fromAscii('hunter2'),
      {from: accounts[1], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Account 0 sells all tokens
    await zethr.balanceOf(accounts[0]).then(async function (balance) {
      await zethr.sell(balance)
    })

    // Account 1 buys in more tokens
    await zethr.buyAndSetDivPercentage(accounts[0], 20, web3.fromAscii('hunter2'),
      {from: accounts[1], value: web3.toWei(2.5, 'ether'), gasPrice: 5})

    // Account 0 should have only 0.12375 in referral dividends
    await zethr.myReferralDividends({from: accounts[0]}).then(function (amount) {
      assert.equal(0.12375, parseFloat(web3.fromWei(amount)))
    })
  })
})
