// Zethr main test suite

const Zethr = artifacts.require('Zethr')
const ZethrBankroll = artifacts.require('ZethrBankroll')
const ZethrDividendCards = artifacts.require('ZethrDividendCards')
const Zethroll = artifacts.require('Zethroll')

var BigNumber = require('bignumber.js')

contract('ZethRoll', accounts => {

  let zethr = null
  let bankroll = null
  let divcards = null
  let zethroll = null

  let divs = [2, 5, 10, 15, 20, 25, 33]

  // Before each test starts, instantiate the bankroll, divcards, and the main zethr contract
  beforeEach(async function () {
    bankroll = await ZethrBankroll.new([accounts[0]], 1)
    divcards = await ZethrDividendCards.new(bankroll.address)
    zethr = await Zethr.new(bankroll.address, divcards.address)
    zethroll = await Zethroll.new(zethr.address, bankroll.address)
    await bankroll.addZethrAddresses(zethr.address, divcards.address)
    await bankroll.whiteListContract(zethroll.address, {from: accounts[0]})
    await bankroll.setDailyTokenLimit(10000e18, {from: accounts[0]})
    await bankroll.alterTokenGrant(zethroll.address, 500e18, {from: accounts[0]})
    await zethr.startICOPhase({from: accounts[0]})

    // We've already tests the other stuff, so just buy in with 5 accounts
    for (let i = 0; i < 20; i++) {
      await zethr.buyAndSetDivPercentage('0x0', 20, web3.fromAscii('hunter2'),
        {from: accounts[i], value: web3.toWei(2.5, 'ether'), gasPrice: 5})
    }

    await zethr.endICOPhase({from: accounts[0]})
    await zethr.startRegularPhase({from: accounts[0]})
    await bankroll.dailyAccounting({from: accounts[0]}) // Should transfer 100 ZTH to the bankroll.
  })

  it('should accept incoming Zethr-tokens', async () => {
    await zethr.transferTo(accounts[0], zethroll.address, 1e18, 51, {from: accounts[0]})
  })
  
  it('should allow a player to roll, and then finish a bet, x500, auto finishing', async () => {
    // Run this test 20 times to account for randomness
    let i = 0;
    let balnceBefore = 0;
    let balanceAfter = 0;
    let result = 0;
    let betID = 0;

    for(i=0; i<5000; i++) {
      
      // Log token balance before
      balanceBefore = parseFloat(web3.fromWei(await zethr.balanceOf(accounts[0])))
      //console.log("Balance Before Bet: " + balanceBefore);

      // Make bet
      //console.log("Betting 1 token for a roll under 51.")

      // Get result of last bet by simulating a new one
      if (i > 0) {
        result = parseFloat(await zethroll._finishBet.call(betID, {from: accounts[0]}))
        //console.log("Result: " + result)
      }

      // Start new bet, finish up old one 
      await zethr.transferTo(accounts[0], zethroll.address, 1e18, 51, {from: accounts[0]})

      // Grab our new balance
      balanceAfter = parseFloat(web3.fromWei(await zethr.balanceOf(accounts[0])))
      console.log("Roll " + i + ", Balance After: " + balanceAfter)

      // Store RNGID of this bet
      betID = await zethroll.rngId()

      // We know the result of the last bet, use this to make sure our token balance is accurate
      if (i > 0) {
        if (result < 51) {
          // Since we transferred in a token to bet, if we win, we should have (1.98 - 1 = 0.98) token increase 
          assert(balanceAfter - balanceBefore - 0.98 < 0.001, "Profit wasn't received correctly." +
                	"Expected: 0.98. Got: " + (balanceAfter - balanceBefore)) 
        } else {
          // Since we transferred in a token to bet, if we lose, we should just have (1) token decrease
					assert((balanceBefore - balanceAfter) == 1, "We didn't lose the token we bet. Balance difference: " +
                	(balanceBefore - balanceAfter))		
       	}
      }
    } 
  })
})
