// Zethr main test suite

const Zethr = artifacts.require('Zethr')
const ZethrBankroll = artifacts.require('ZethrBankroll')
const ZethrDividendCards = artifacts.require('ZethrDividendCards')
const Zethell = artifacts.require('Zethell')

var BigNumber = require('bignumber.js')

contract('Zethell', accounts => {

  let zethr = null
  let bankroll = null
  let divcards = null
  let zethell = null

  let divs = [2, 5, 10, 15, 20, 25, 33]

  // Before each test starts, instantiate the bankroll, divcards, and the main zethr contract
  beforeEach(async function () {
    bankroll = await ZethrBankroll.new([accounts[0]], 1)
    divcards = await ZethrDividendCards.new(bankroll.address)
    zethr = await Zethr.new(bankroll.address, divcards.address)
    zethell = await Zethell.new(zethr.address, bankroll.address)
    await bankroll.addZethrAddresses(zethr.address, divcards.address)
    await zethr.startICOPhase({from: accounts[0]})

    // We've already tests the other stuff, so just buy in with 5 accounts
    for(let i = 0; i < 5; i++) {
      await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
        {from: accounts[i], value: web3.toWei(2.5, 'ether'), gasPrice: 5})
    }

    await zethr.endICOPhase({from: accounts[0]})
    await zethr.startRegularPhase({from: accounts[0]})
  })

  it('should prevent bids while the game is paused', async () => {
    await zethr.transferTo(accounts[0], zethell.address, 5e18, "").then(function (returnValue) {
      assert(false, 'Expected Solidity to revert here.')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      } 
    })
  })

  it('should allow a normal bid when the game is not paused', async () => {
    await zethell.resumeGame()
    await zethr.transferTo(accounts[0], zethell.address, 5e18, "", {from: accounts[0]})
  })

  it('should not allow a non-valid token bet amount', async () => {
    await zethell.resumeGame()
    await zethr.transferTo(accounts[0], zethell.address, 7e18, "", {from: accounts[0]}).then(function (returnValue) {
      assert(false, 'Expected Solidity to revert here.') 
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })

  it('should set the remaining time appropriately for each valid token bet', async () => {
    await zethell.resumeGame()
    let endTime = 0   
    let delta = 0
 
    endTime = parseFloat(await zethell.gameEnds())
    await zethr.transferTo(accounts[0], zethell.address, 5e18, "", {from: accounts[0]})
    delta = parseFloat(await zethell.gameEnds()) - endTime
    // 5 tokens means 60 minutes left
    assert(delta - 3600 < 10, 'We bid 5 tokens, but did not add an hour to game end. Old timestamp: ' + endTime + ', New Timestamp: ' + (delta + endTime))

    endTime = parseFloat(await zethell.gameEnds())
    await zethr.transferTo(accounts[1], zethell.address, 10e18, "", {from: accounts[1]})
    delta = parseFloat(await zethell.gameEnds()) - endTime
    // 10 tokens means 40 minutes left
		assert(delta - 2400 < 10, 'We bid 10 tokens, but did not add 40 minutes to game end. Old timestamp: ' + endTime + ', New Timestamp: ' + (delta + endTime))

    endTime = parseFloat(await zethell.gameEnds())
    await zethr.transferTo(accounts[2], zethell.address, 25e18, "", {from: accounts[2]})
    delta = parseFloat(await zethell.gameEnds()) - endTime
    // 25 tokens means 25 minutes left
		assert(delta - 1500 < 10, 'We bid 25 tokens, but did not add 25 minutes to game end. Old timestamp: ' + endTime + ', New Timestamp: ' + (delta + endTime))

    endTime = parseFloat(await zethell.gameEnds())
    await zethr.transferTo(accounts[3], zethell.address, 50e18, "", {from: accounts[3]})
    delta = parseFloat(await zethell.gameEnds()) - endTime
    // 50 tokens means 15 minutes left  
		assert(delta - 900 < 10, 'We bid 50 tokens, but did not add 15 minutes to game end. Old timestamp: ' + endTime + ', New Timestamp: ' + (delta + endTime))
  })

  it('should update the current leader when a bid is placed', async () => {
    await zethell.resumeGame()
		let leader = null

		leader = await zethell.currentWinner()
		assert(leader == bankroll.address, "Leader was not bankroll. Leader was: " + leader)
		await zethr.transferTo(accounts[0], zethell.address, 5e18, "", {from: accounts[0]})
		leader = await zethell.currentWinner()
		assert(leader == accounts[0], "Leader was not account 0. Leader was: " + leader)
  })

  it('should send the house cut to the bankroll on a bid', async () => {
    await zethell.resumeGame()
    let bankrollBalance = null
    let newBalance = null
    let temp = null

    bankrollBalance = await zethr.balanceOf(bankroll.address)

    await zethr.transferTo(accounts[0], zethell.address, 50e18, "", {from: accounts[0]}) 
    await zethell.retrieveHouseTake()

    newBalance = await zethr.balanceOf(bankroll.address) 

    let diff = parseFloat(web3.fromWei(newBalance)) - parseFloat(web3.fromWei(bankrollBalance))
    assert(diff == 0.5, "Bankroll did not get 1 percent of the tokens (0.5 tokens). Instead, got: " + diff)
  })

  it('should add everything but the house cut to the tokens in play on a bid', async () => {
    await zethell.resumeGame()
    
    await zethr.transferTo(accounts[0], zethell.address, 50e18, "", {from: accounts[0]})
    await zethell.tokensInPlay().then(function (numTokens) {
      assert(parseFloat(web3.fromWei(numTokens)) == 49.5, 
        "Should have 49.5 tokens in play, but had this number instead: " 
        + parseFloat(web3.fromWei(numTokens)))
    }) 

    await zethr.transferTo(accounts[1], zethell.address, 5e18, "", {from: accounts[1]})
    await zethell.tokensInPlay().then(function (numTokens) {
      assert(parseFloat(web3.fromWei(numTokens)) == 54.45, 
      "Should have had 54.45 tokens in play, but had this number instead: " 
      + parseFloat(web3.fromWei(numTokens))) 
    })
    
  })

  it('should only accept bids via the zethr contract', async () => {
    await zethell.resumeGame()
  
    await zethell.tokenFallback(accounts[0], 5e18, '').then(function(returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t.')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString()) 
      }
    })
  })

  it('should only let an owner pause and resume the game', async () => {
    // These should work
    await zethell.resumeGame({from: accounts[0]})
    await zethell.pauseGame({from: accounts[0]})

    // These should revert
    await zethell.resumeGame({from: accounts[1]}).then(function(returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t.')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })

    await zethell.pauseGame({from: accounts[1]}).then(function(returnValue) {
      assert(false, 'Was supposed to throw here, but didn\'t.')
    }).catch((err) => {
      if (err.toString().indexOf('revert') != -1) {
        // Nothing, we're good - Solidity reverted the transaction
      } else {
        assert(false, err.toString())
      }
    })
  })
})
